begin;
create table public.class_homework(
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.classes(id),
 subject_id uuid not null references public.subjects(id),
 due_date date not null,
 body text not null check(char_length(btrim(body)) between 1 and 1000),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 deleted_at timestamptz,
 moderation_status text not null default 'visible' check(moderation_status in('visible','hidden'))
);
create index homework_class_date on public.class_homework(class_id,due_date,id);
create index homework_author_rate on public.class_homework(created_by,created_at desc);
alter table public.class_homework enable row level security;
revoke all on public.class_homework from public,anon,authenticated;
grant select on public.class_homework to authenticated;
create policy homework_own_class on public.class_homework for select to authenticated using(
 public.is_admin() or (deleted_at is null and moderation_status='visible' and class_id=(select class_id from public.profiles where id=auth.uid()))
);
create function public.save_class_homework(p_subject uuid,p_due date,p_body text,p_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; result uuid;
begin
 if uid is null then raise exception 'authentication_required'; end if;
 -- Class never comes from a client argument. Lock profile through the entire mutation.
 select class_id into cid from public.profiles where id=uid for share;
 if cid is null then raise exception 'unavailable'; end if;
 if p_body is null or char_length(btrim(p_body)) not between 1 and 1000 or p_due is null or p_due<current_date-interval '366 days' or p_due>current_date+interval '366 days' or not exists(select 1 from public.subjects where id=p_subject) then raise exception 'invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,756));
 if p_id is null then
  if (select count(*) from public.class_homework where created_by=uid and created_at>now()-interval '1 day')>=20 then raise exception 'rate_limit'; end if;
  insert into public.class_homework(class_id,subject_id,due_date,body,created_by) values(cid,p_subject,p_due,btrim(p_body),uid) returning id into result;
 else
  update public.class_homework set subject_id=p_subject,due_date=p_due,body=btrim(p_body),updated_at=now()
   where id=p_id and created_by=uid and class_id=cid and deleted_at is null and moderation_status='visible' returning id into result;
  if result is null then raise exception 'unavailable'; end if;
 end if;
 return result;
end $$;
create function public.delete_class_homework(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 update public.class_homework set deleted_at=coalesce(deleted_at,now()),updated_at=now()
 where id=p_id and created_by=auth.uid() and class_id=(select class_id from public.profiles where id=auth.uid());
 if not found then raise exception 'unavailable'; end if;
end $$;
create function public.moderate_class_homework(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'unavailable'; end if;
 update public.class_homework set moderation_status='hidden',updated_at=now() where id=p_id;
 if not found then raise exception 'unavailable'; end if;
end $$;
create or replace function public.community_report_target(p_kind text,p_target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select case p_kind
 when 'profile' then p_target<>auth.uid() and exists(select 1 from public.profiles where id=p_target)
 when 'message' then exists(select 1 from public.direct_messages m join public.dm_threads t on t.id=m.thread_id where m.id=p_target and m.sender_id<>auth.uid() and auth.uid() in(t.participant_a,t.participant_b))
 when 'homework' then exists(select 1 from public.class_homework h where h.id=p_target and h.created_by<>auth.uid() and h.deleted_at is null and h.moderation_status='visible' and h.class_id=(select class_id from public.profiles where id=auth.uid()))
 else false end;
$$;
create or replace function public.community_report_context(p_id uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare r public.community_reports;
begin
 if not public.is_admin() then raise exception 'unavailable'; end if;
 select * into r from public.community_reports where id=p_id;
 if r.target_kind='message' then return (select body from public.direct_messages where id=r.target_id); end if;
 if r.target_kind='profile' then return (select concat_ws(E'\n',display_name,bio) from public.profiles where id=r.target_id); end if;
 if r.target_kind='homework' then return (select body from public.class_homework where id=r.target_id); end if;
 return null;
end $$;
revoke all on function public.save_class_homework(uuid,date,text,uuid),public.delete_class_homework(uuid),public.moderate_class_homework(uuid) from public,anon;
grant execute on function public.save_class_homework(uuid,date,text,uuid),public.delete_class_homework(uuid),public.moderate_class_homework(uuid) to authenticated;
commit;
