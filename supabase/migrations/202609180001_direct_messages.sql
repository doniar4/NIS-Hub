begin;
-- Keep existing names intact. Resolve duplicate names in Table Editor before applying.
create unique index profiles_display_name_unique on public.profiles (lower(btrim(display_name))) where display_name is not null;
alter table public.profiles add constraint profiles_display_name_not_blank check (display_name is null or char_length(btrim(display_name)) between 1 and 60);

create table public.dm_threads (
 id uuid primary key default gen_random_uuid(),
 participant_a uuid not null references public.profiles(id) on delete cascade,
 participant_b uuid not null references public.profiles(id) on delete cascade,
 read_a timestamptz, read_b timestamptz,
 created_at timestamptz not null default now(),
 constraint dm_ordered_pair check (participant_a < participant_b),
 unique(participant_a,participant_b)
);
create table public.direct_messages (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.dm_threads(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade,
 body text not null check (char_length(btrim(body)) between 1 and 2000),
 client_id uuid not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(sender_id,client_id)
);
create index dm_history on public.direct_messages(thread_id,created_at desc,id desc);
create index dm_sender_rate on public.direct_messages(sender_id,created_at desc);
create index dm_a on public.dm_threads(participant_a);
create index dm_b on public.dm_threads(participant_b);
create table public.web_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 actor_id uuid not null references public.profiles(id) on delete cascade,
 thread_id uuid not null references public.dm_threads(id) on delete cascade,
 message_id uuid not null unique references public.direct_messages(id) on delete cascade,
 created_at timestamptz not null default clock_timestamp(),
 read_at timestamptz
);
create index notification_inbox on public.web_notifications(recipient_id,created_at desc);
alter table public.dm_threads enable row level security;
alter table public.direct_messages enable row level security;
alter table public.web_notifications enable row level security;
revoke all on public.dm_threads,public.direct_messages,public.web_notifications from anon,authenticated;
grant select on public.dm_threads,public.direct_messages,public.web_notifications to authenticated;
create policy dm_members on public.dm_threads for select to authenticated using(auth.uid() in (participant_a,participant_b));
create policy dm_messages_members on public.direct_messages for select to authenticated using(exists(select 1 from public.dm_threads t where t.id=thread_id and auth.uid() in(t.participant_a,t.participant_b)));
create policy own_notifications on public.web_notifications for select to authenticated using(recipient_id=auth.uid());

create function public.start_dm(p_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); peer uuid; tid uuid;
begin
 if uid is null then raise exception 'authentication_required'; end if;
 if not exists(select 1 from profiles where id=uid and nullif(btrim(display_name),'') is not null) then raise exception 'name_required'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'invalid_name'; end if;
 select id into peer from profiles where lower(btrim(display_name))=lower(btrim(p_name));
 if peer is null or peer=uid then raise exception 'recipient_unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,71));
 select id into tid from dm_threads where participant_a=least(uid,peer) and participant_b=greatest(uid,peer);
 if tid is not null then return tid; end if;
 if (select count(*) from dm_threads where uid in(participant_a,participant_b) and created_at>now()-interval '1 hour')>=30 then raise exception 'rate_limit'; end if;
 insert into dm_threads(participant_a,participant_b) values(least(uid,peer),greatest(uid,peer)) on conflict(participant_a,participant_b) do update set participant_a=excluded.participant_a returning id into tid;
 return tid;
end $$;

create function public.send_dm(p_thread uuid,p_body text,p_client uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); peer uuid; mid uuid; existing direct_messages;
begin
 if uid is null then raise exception 'authentication_required'; end if;
 select case when participant_a=uid then participant_b else participant_a end into peer from dm_threads where id=p_thread and uid in(participant_a,participant_b);
 if peer is null then raise exception 'thread_unavailable'; end if;
 if p_client is null or p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'invalid_message'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,72));
 select * into existing from direct_messages where sender_id=uid and client_id=p_client;
 if existing.id is not null then
  if existing.thread_id<>p_thread or existing.body<>btrim(p_body) then raise exception 'invalid_message'; end if;
  return existing.id;
 end if;
 if (select count(*) from direct_messages where sender_id=uid and created_at>now()-interval '1 minute')>=20 then raise exception 'rate_limit'; end if;
 insert into direct_messages(thread_id,sender_id,body,client_id) values(p_thread,uid,btrim(p_body),p_client) returning id into mid;
 insert into web_notifications(recipient_id,actor_id,thread_id,message_id) values(peer,uid,p_thread,mid);
 return mid;
end $$;

create function public.dm_inbox() returns table(id uuid,peer_name text,last_body text,last_at timestamptz,unread bigint)
language sql stable security definer set search_path=public as $$
 select t.id,p.display_name,m.body,coalesce(m.created_at,t.created_at),
 (select count(*) from direct_messages d where d.thread_id=t.id and d.sender_id<>auth.uid() and d.created_at>coalesce(case when t.participant_a=auth.uid() then t.read_a else t.read_b end,'-infinity'::timestamptz))
 from dm_threads t join profiles p on p.id=case when t.participant_a=auth.uid() then t.participant_b else t.participant_a end
 left join lateral(select body,created_at from direct_messages where thread_id=t.id order by created_at desc,id desc limit 1)m on true
 where auth.uid() in(t.participant_a,t.participant_b) order by coalesce(m.created_at,t.created_at) desc limit 200;
$$;

create function public.read_dm(p_thread uuid,p_message uuid) returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); seen timestamptz;
begin
 if uid is null or not exists(select 1 from dm_threads where id=p_thread and uid in(participant_a,participant_b)) then raise exception 'thread_unavailable'; end if;
 select created_at into seen from direct_messages where id=p_message and thread_id=p_thread;
 if seen is null then return; end if;
 update dm_threads set read_a=case when participant_a=uid then greatest(read_a,seen) else read_a end,read_b=case when participant_b=uid then greatest(read_b,seen) else read_b end where id=p_thread;
 update web_notifications set read_at=now() where recipient_id=uid and thread_id=p_thread and created_at <= (select created_at from web_notifications where message_id=p_message) and read_at is null;
 -- Use message timestamps as well when the last visible message was sent by the reader.
 update web_notifications n set read_at=now() from direct_messages m where n.message_id=m.id and n.recipient_id=uid and n.thread_id=p_thread and m.created_at<=seen and n.read_at is null;
end $$;

create function public.notification_feed() returns table(id uuid,thread_id uuid,actor_name text,created_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path=public as $$
 select n.id,n.thread_id,p.display_name,n.created_at,n.read_at from web_notifications n join profiles p on p.id=n.actor_id where n.recipient_id=auth.uid() order by n.created_at desc,n.id desc limit 30;
$$;
create function public.dismiss_notification(p_id uuid) returns void language sql security definer set search_path=public as $$
 update web_notifications set read_at=now() where recipient_id=auth.uid() and id=p_id and read_at is null;
$$;
revoke all on function public.start_dm(text),public.send_dm(uuid,text,uuid),public.dm_inbox(),public.read_dm(uuid,uuid),public.notification_feed(),public.dismiss_notification(uuid) from public,anon;
grant execute on function public.start_dm(text),public.send_dm(uuid,text,uuid),public.dm_inbox(),public.read_dm(uuid,uuid),public.notification_feed(),public.dismiss_notification(uuid) to authenticated;
comment on column public.profiles.display_name is 'Unique case-insensitive name for direct messages. Manage in Table Editor or Profile. NULL is allowed until a student chooses a name.';
commit;
