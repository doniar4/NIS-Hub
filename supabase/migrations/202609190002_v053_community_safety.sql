begin;
create table public.dm_thread_preferences (
 user_id uuid not null references public.profiles(id) on delete cascade,
 thread_id uuid not null references public.dm_threads(id) on delete cascade,
 hidden boolean not null default false,
 primary key(user_id,thread_id)
);
alter table public.dm_thread_preferences enable row level security;
revoke all on public.dm_thread_preferences from public,anon,authenticated;
grant select on public.dm_thread_preferences to authenticated;
create policy own_thread_preferences on public.dm_thread_preferences for select to authenticated using(user_id=auth.uid());

alter table public.direct_messages add column deleted_at timestamptz;
-- Keep original text for existing data/audit, but never return deleted text to participants.
create policy hide_deleted_message_bodies on public.direct_messages as restrictive for select to authenticated using(deleted_at is null);
create table public.community_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references public.profiles(id) on delete cascade,
 target_kind text not null check(target_kind in('profile','message','homework')),
 target_id uuid not null,
 reason text not null check(reason in('spam','harassment','privacy','other')),
 detail text not null default '' check(char_length(detail)<=500),
 status text not null default 'open' check(status in('open','resolved')),
 created_at timestamptz not null default now(), resolved_at timestamptz,
 resolved_by uuid references public.profiles(id) on delete set null
);
create index community_reports_rate on public.community_reports(reporter_id,created_at desc);
alter table public.community_reports enable row level security;
revoke all on public.community_reports from public,anon,authenticated;
grant select on public.community_reports to authenticated;
create policy admin_reports on public.community_reports for select to authenticated using(public.is_admin());

create function public.set_user_block(p_peer uuid,p_blocked boolean) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'authentication_required'; end if;
 if p_peer is null or p_peer=uid or p_blocked is null or not exists(select 1 from public.profiles where id=p_peer) then raise exception 'unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(uid,p_peer)::text||greatest(uid,p_peer)::text,753));
 if p_blocked then
  insert into public.user_blocks(blocker_id,blocked_id) values(uid,p_peer) on conflict do nothing;
  delete from public.friendships where user_a=least(uid,p_peer) and user_b=greatest(uid,p_peer);
  update public.web_notifications set read_at=coalesce(read_at,now()) where recipient_id=uid and actor_id=p_peer;
 else delete from public.user_blocks where blocker_id=uid and blocked_id=p_peer;
 end if;
end $$;
create function public.set_dm_hidden(p_thread uuid,p_hidden boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_hidden is null or not exists(select 1 from public.dm_threads where id=p_thread and auth.uid() in(participant_a,participant_b)) then raise exception 'unavailable'; end if;
 insert into public.dm_thread_preferences(user_id,thread_id,hidden) values(auth.uid(),p_thread,p_hidden)
 on conflict(user_id,thread_id) do update set hidden=excluded.hidden;
end $$;
create function public.delete_own_dm(p_message uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 update public.direct_messages set deleted_at=coalesce(deleted_at,now()) where id=p_message and sender_id=auth.uid();
 if not found then raise exception 'unavailable'; end if;
 update public.web_notifications set read_at=coalesce(read_at,now()) where message_id=p_message;
end $$;

-- Shared pair lock serializes block vs send/start/friend, including direct RPC calls.
create or replace function public.start_dm(p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); peer uuid; tid uuid;
begin
 if uid is null then raise exception 'authentication_required'; end if;
 if not exists(select 1 from public.profiles where id=uid and nullif(btrim(display_name),'') is not null) then raise exception 'name_required'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then raise exception 'invalid_name'; end if;
 select id into peer from public.profiles where lower(btrim(display_name))=lower(btrim(p_name));
 if peer is null or peer=uid then raise exception 'recipient_unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(uid,peer)::text||greatest(uid,peer)::text,753));
 if not public.community_pair_allowed(uid,peer) then raise exception 'recipient_unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,71));
 select id into tid from public.dm_threads where participant_a=least(uid,peer) and participant_b=greatest(uid,peer);
 if tid is null then
  if (select count(*) from public.dm_threads where uid in(participant_a,participant_b) and created_at>now()-interval '1 hour')>=30 then raise exception 'rate_limit'; end if;
  insert into public.dm_threads(participant_a,participant_b) values(least(uid,peer),greatest(uid,peer)) returning id into tid;
 end if;
 perform public.set_dm_hidden(tid,false);
 return tid;
end $$;
create or replace function public.send_dm(p_thread uuid,p_body text,p_client uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); peer uuid; mid uuid; existing public.direct_messages;
begin
 if uid is null then raise exception 'authentication_required'; end if;
 select case when participant_a=uid then participant_b else participant_a end into peer from public.dm_threads where id=p_thread and uid in(participant_a,participant_b);
 if peer is null then raise exception 'thread_unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(uid,peer)::text||greatest(uid,peer)::text,753));
 if not public.community_pair_allowed(uid,peer) then raise exception 'recipient_unavailable'; end if;
 if p_client is null or p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then raise exception 'invalid_message'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,72));
 select * into existing from public.direct_messages where sender_id=uid and client_id=p_client;
 if existing.id is not null then
  if existing.thread_id<>p_thread or existing.body<>btrim(p_body) then raise exception 'invalid_message'; end if;
  return existing.id;
 end if;
 if (select count(*) from public.direct_messages where sender_id=uid and created_at>now()-interval '1 minute')>=20 then raise exception 'rate_limit'; end if;
 insert into public.direct_messages(thread_id,sender_id,body,client_id) values(p_thread,uid,btrim(p_body),p_client) returning id into mid;
 insert into public.web_notifications(recipient_id,actor_id,thread_id,message_id) values(peer,uid,p_thread,mid);
 -- Intentionally do NOT unhide a peer's thread.
 return mid;
end $$;
create function public.dm_inbox_v053() returns table(id uuid,peer_id uuid,peer_name text,last_body text,last_deleted boolean,last_at timestamptz,unread bigint,blocked boolean)
language sql stable security definer set search_path='' as $$
 select t.id,p.id,p.display_name,case when m.deleted_at is null then left(m.body,120) else null end,m.deleted_at is not null,coalesce(m.created_at,t.created_at),
 (select count(*) from public.direct_messages d where d.thread_id=t.id and d.sender_id<>auth.uid() and d.deleted_at is null and d.created_at>coalesce(case when t.participant_a=auth.uid() then t.read_a else t.read_b end,'-infinity'::timestamptz)),
 not public.community_pair_allowed(auth.uid(),p.id)
 from public.dm_threads t join public.profiles p on p.id=case when t.participant_a=auth.uid() then t.participant_b else t.participant_a end
 left join lateral(select body,created_at,deleted_at from public.direct_messages where thread_id=t.id order by created_at desc,id desc limit 1)m on true
 where auth.uid() in(t.participant_a,t.participant_b)
 and not exists(select 1 from public.dm_thread_preferences pref where pref.thread_id=t.id and pref.user_id=auth.uid() and pref.hidden)
 order by coalesce(m.created_at,t.created_at) desc,t.id limit 200;
$$;
create or replace function public.dm_inbox() returns table(id uuid,peer_name text,last_body text,last_at timestamptz,unread bigint)
language sql stable security definer set search_path='' as $$
 select d.id,d.peer_name,d.last_body,d.last_at,d.unread from public.dm_inbox_v053() d;
$$;
create function public.dm_history_v053(p_thread uuid,p_before timestamptz default null,p_id uuid default null)
returns table(id uuid,thread_id uuid,sender_id uuid,body text,client_id uuid,created_at timestamptz,deleted_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.dm_threads t where t.id=p_thread and auth.uid() in(t.participant_a,t.participant_b)) then raise exception 'unavailable'; end if;
 return query select m.id,m.thread_id,m.sender_id,case when m.deleted_at is null then m.body else '' end,m.client_id,m.created_at,m.deleted_at
 from public.direct_messages m where m.thread_id=p_thread and (p_before is null or (m.created_at,m.id)<(p_before,p_id))
 order by m.created_at desc,m.id desc limit 51;
end $$;
create function public.notification_feed_v053() returns table(id uuid,thread_id uuid,actor_name text,body_preview text,created_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path='' as $$
 select n.id,n.thread_id,p.display_name,
 case when char_length(m.body)>120 then left(m.body,119)||'…' else m.body end,n.created_at,n.read_at
 from public.web_notifications n join public.profiles p on p.id=n.actor_id join public.direct_messages m on m.id=n.message_id
 where n.recipient_id=auth.uid() and m.deleted_at is null and public.community_pair_allowed(auth.uid(),n.actor_id)
 and not exists(select 1 from public.dm_thread_preferences pref where pref.thread_id=n.thread_id and pref.user_id=auth.uid() and pref.hidden)
 order by n.created_at desc,n.id desc limit 30;
$$;
create function public.notification_unread_v053() returns bigint
language sql stable security definer set search_path='' as $$
 select count(*) from public.web_notifications n join public.direct_messages m on m.id=n.message_id
 where n.recipient_id=auth.uid() and n.read_at is null and m.deleted_at is null
 and public.community_pair_allowed(auth.uid(),n.actor_id)
 and not exists(select 1 from public.dm_thread_preferences pref where pref.thread_id=n.thread_id and pref.user_id=auth.uid() and pref.hidden);
$$;
revoke all on function public.notification_unread_v053() from public,anon;
grant execute on function public.notification_unread_v053() to authenticated;

create or replace function public.notification_feed() returns table(id uuid,thread_id uuid,actor_name text,created_at timestamptz,read_at timestamptz)
language sql stable security definer set search_path='' as $$
 select n.id,n.thread_id,n.actor_name,n.created_at,n.read_at from public.notification_feed_v053() n;
$$;
-- Visibility validation is extended for homework by migration 003.
create function public.community_report_target(p_kind text,p_target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select case p_kind
 when 'profile' then p_target<>auth.uid() and exists(select 1 from public.profiles where id=p_target)
 when 'message' then exists(select 1 from public.direct_messages m join public.dm_threads t on t.id=m.thread_id where m.id=p_target and m.sender_id<>auth.uid() and auth.uid() in(t.participant_a,t.participant_b))
 else false end;
$$;
create function public.report_community(p_kind text,p_target uuid,p_reason text,p_detail text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if p_detail is null or char_length(p_detail)>500 or p_reason is null or p_reason not in('spam','harassment','privacy','other') or not public.community_report_target(p_kind,p_target) then raise exception 'unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,755));
 if (select count(*) from public.community_reports where reporter_id=auth.uid() and created_at>now()-interval '1 day')>=10 then raise exception 'rate_limit'; end if;
 insert into public.community_reports(reporter_id,target_kind,target_id,reason,detail) values(auth.uid(),p_kind,p_target,p_reason,btrim(p_detail)) returning id into result;
 return result;
end $$;
create function public.resolve_community_report(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'unavailable'; end if;
 update public.community_reports set status='resolved',resolved_at=now(),resolved_by=auth.uid() where id=p_id;
end $$;
-- Admin inspection is narrowly scoped to an existing report, never an unrestricted DM inbox.
create function public.community_report_context(p_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare r public.community_reports;
begin
 if not public.is_admin() then raise exception 'unavailable'; end if;
 select * into r from public.community_reports where id=p_id;
 if r.target_kind='message' then return (select body from public.direct_messages where id=r.target_id); end if;
 if r.target_kind='profile' then return (select concat_ws(E'\n',display_name,bio) from public.profiles where id=r.target_id); end if;
 return null;
end $$;

revoke all on function public.set_user_block(uuid,boolean),public.set_dm_hidden(uuid,boolean),public.delete_own_dm(uuid),
 public.dm_inbox_v053(),public.dm_history_v053(uuid,timestamptz,uuid),public.notification_feed_v053(),
 public.community_report_target(text,uuid),public.report_community(text,uuid,text,text),public.resolve_community_report(uuid),public.community_report_context(uuid)
 from public,anon;
grant execute on function public.set_user_block(uuid,boolean),public.set_dm_hidden(uuid,boolean),public.delete_own_dm(uuid),
 public.dm_inbox_v053(),public.dm_history_v053(uuid,timestamptz,uuid),public.notification_feed_v053(),
 public.report_community(text,uuid,text,text),public.resolve_community_report(uuid),public.community_report_context(uuid) to authenticated;
-- Private helper has no direct API grant.
revoke all on function public.community_report_target(text,uuid) from authenticated;
commit;
