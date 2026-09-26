begin;

create table public.personal_tasks (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 subject_id uuid references public.subjects(id) on delete set null,
 title text not null check (char_length(btrim(title)) between 1 and 120),
 notes text not null default '' check (char_length(notes) <= 1000),
 priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
 status text not null default 'active' check (status in ('active','completed','archived')),
 due_at timestamptz,
 remind_at timestamptz,
 reminder_read_at timestamptz,
 completed_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 constraint personal_task_reminder_needs_due check (remind_at is null or due_at is not null),
 constraint personal_task_reminder_before_due check (remind_at is null or remind_at <= due_at)
);

create index personal_tasks_owner_active
 on public.personal_tasks(owner_id,status,due_at nulls last,created_at desc);
create index personal_tasks_due_reminders
 on public.personal_tasks(remind_at,owner_id)
 where status='active' and remind_at is not null and reminder_read_at is null;

alter table public.personal_tasks enable row level security;
revoke all on public.personal_tasks from public,anon,authenticated;
grant select on public.personal_tasks to authenticated;
create policy personal_tasks_owner_select on public.personal_tasks
 for select to authenticated using(owner_id=auth.uid());

create function public.save_personal_task(
 p_id uuid,
 p_title text,
 p_notes text,
 p_priority text,
 p_subject uuid,
 p_due timestamptz,
 p_remind timestamptz
) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result uuid;
begin
 if uid is null then raise exception 'authentication_required'; end if;
 if p_title is null or char_length(btrim(p_title)) not between 1 and 120
  or p_notes is null or char_length(p_notes)>1000
  or p_priority not in ('low','medium','high','urgent')
  or (p_subject is not null and not exists(select 1 from public.subjects where id=p_subject))
  or (p_due is not null and (p_due < now()-interval '366 days' or p_due > now()+interval '730 days'))
  or (p_remind is not null and (p_due is null or p_remind>p_due or p_remind<now()-interval '7 days'))
 then raise exception 'invalid_input'; end if;

 perform pg_advisory_xact_lock(hashtextextended(uid::text,764));
 if p_id is null then
  if (select count(*) from public.personal_tasks where owner_id=uid and created_at>now()-interval '1 day')>=100
   then raise exception 'rate_limit'; end if;
  if (select count(*) from public.personal_tasks where owner_id=uid and status='active')>=500
   then raise exception 'task_limit'; end if;
  insert into public.personal_tasks(owner_id,subject_id,title,notes,priority,due_at,remind_at)
  values(uid,p_subject,btrim(p_title),btrim(p_notes),p_priority,p_due,p_remind)
  returning id into result;
 else
  update public.personal_tasks set
   subject_id=p_subject,title=btrim(p_title),notes=btrim(p_notes),priority=p_priority,
   due_at=p_due,remind_at=p_remind,
   reminder_read_at=case when remind_at is distinct from p_remind then null else reminder_read_at end,
   updated_at=clock_timestamp()
  where id=p_id and owner_id=uid and status<>'archived'
  returning id into result;
  if result is null then raise exception 'unavailable'; end if;
 end if;
 return result;
end $$;

create function public.set_personal_task_status(p_id uuid,p_status text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if p_status not in ('active','completed','archived') then raise exception 'invalid_input'; end if;
 update public.personal_tasks set
  status=p_status,
  completed_at=case when p_status='completed' then coalesce(completed_at,clock_timestamp()) else null end,
  reminder_read_at=case when p_status='active' then null else coalesce(reminder_read_at,clock_timestamp()) end,
  updated_at=clock_timestamp()
 where id=p_id and owner_id=auth.uid();
 if not found then raise exception 'unavailable'; end if;
end $$;

create function public.snooze_personal_task(p_id uuid,p_minutes integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if p_minutes not in (5,10,15,30,60,180,1440) then raise exception 'invalid_input'; end if;
 update public.personal_tasks set
  remind_at=least(clock_timestamp()+make_interval(mins=>p_minutes),due_at),
  reminder_read_at=null,
  updated_at=clock_timestamp()
 where id=p_id and owner_id=auth.uid() and status='active' and due_at is not null;
 if not found then raise exception 'unavailable'; end if;
end $$;

create function public.task_notification_feed() returns table(
 id uuid,task_id uuid,title text,priority text,due_at timestamptz,remind_at timestamptz,read_at timestamptz
)
language sql stable security definer set search_path='' as $$
 select t.id,t.id,t.title,t.priority,t.due_at,t.remind_at,t.reminder_read_at
 from public.personal_tasks t
 where t.owner_id=auth.uid() and t.status='active' and t.remind_at<=clock_timestamp()
 order by t.remind_at desc,t.id desc limit 30;
$$;

create function public.task_notification_unread() returns bigint
language sql stable security definer set search_path='' as $$
 select count(*) from public.personal_tasks
 where owner_id=auth.uid() and status='active' and remind_at<=clock_timestamp() and reminder_read_at is null;
$$;

create function public.dismiss_task_notification(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 update public.personal_tasks set reminder_read_at=coalesce(reminder_read_at,clock_timestamp()),updated_at=clock_timestamp()
 where id=p_id and owner_id=auth.uid();
 if not found then raise exception 'unavailable'; end if;
end $$;

revoke all on function public.save_personal_task(uuid,text,text,text,uuid,timestamptz,timestamptz),
 public.set_personal_task_status(uuid,text),public.snooze_personal_task(uuid,integer),
 public.task_notification_feed(),public.task_notification_unread(),public.dismiss_task_notification(uuid)
 from public,anon;
grant execute on function public.save_personal_task(uuid,text,text,text,uuid,timestamptz,timestamptz),
 public.set_personal_task_status(uuid,text),public.snooze_personal_task(uuid,integer),
 public.task_notification_feed(),public.task_notification_unread(),public.dismiss_task_notification(uuid)
 to authenticated;

commit;
