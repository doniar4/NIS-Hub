begin;

-- Extend the private retry ledger, not class_homework or its existing RLS/RPC.
alter table public.telegram_homework_updates drop constraint telegram_homework_updates_outcome_check;
alter table public.telegram_homework_updates add constraint telegram_homework_updates_outcome_check
 check (outcome in ('welcome','grade','class','subject','date','body','confirm','published','cancelled','invalid','body_invalid','rate_limited'));
-- This predicate also keeps invalid/cancelled attempts out of quota accounting.
create index telegram_homework_published_user_time
 on public.telegram_homework_updates(telegram_user_id,created_at desc) where outcome='published';

create or replace function public.telegram_homework_apply_update(
 p_update_id bigint, p_user_id bigint, p_action text, p_value text,
 p_token text, p_author uuid
) returns text language plpgsql security invoker set search_path = '' set statement_timeout = '8s' as $$
declare
 s public.telegram_homework_sessions;
 result text := 'invalid'; claimed bigint; published uuid; chosen uuid; g smallint;
 local_today date := (now() at time zone 'Asia/Oral')::date;
 old_user bigint;
begin
 if p_user_id is null or p_user_id not between 1 and 9007199254740991
  or p_update_id is null or p_update_id not between 0 and 9007199254740991
  or p_action is null or p_action not in ('start','add','cancel','grade','class','subject','date','body','publish','edit','inline_cancel') then
  return 'invalid';
 end if;
 -- Same per-user lock covers update deduplication AND the quota check/insert.
 perform pg_advisory_xact_lock(hashtextextended('telegram-homework:' || p_user_id::text, 758));
 insert into public.telegram_homework_updates(update_id,telegram_user_id,outcome)
 values(p_update_id,p_user_id,'invalid') on conflict do nothing returning update_id into claimed;
 if claimed is null then
  select outcome,telegram_user_id into result,old_user from public.telegram_homework_updates where update_id=p_update_id;
  return case when old_user=p_user_id then result else 'invalid' end;
 end if;

 delete from public.telegram_homework_sessions where telegram_user_id=p_user_id and expires_at<=now();
 select * into s from public.telegram_homework_sessions where telegram_user_id=p_user_id for update;
 if s.telegram_user_id is not null and p_update_id<=s.last_update_id then
  result := 'invalid';
 elsif p_action='start' then
  result := 'welcome';
 elsif p_action='add' then
  insert into public.telegram_homework_sessions(telegram_user_id,step,token,last_update_id)
  values(p_user_id,'grade',substr(replace(gen_random_uuid()::text,'-',''),1,12),p_update_id)
  on conflict(telegram_user_id) do update set step='grade',grade=null,class_id=null,subject_id=null,due_date=null,body=null,
   token=excluded.token,last_update_id=excluded.last_update_id,updated_at=now(),expires_at=now()+interval '30 minutes';
  result := 'grade';
 elsif p_action='cancel' then
  delete from public.telegram_homework_sessions where telegram_user_id=p_user_id;
  result := 'cancelled';
 elsif s.telegram_user_id is null then
  result := 'invalid';
 elsif p_action<>'body' and (p_token is null or p_token<>s.token) then
  result := 'invalid';
 elsif p_action='inline_cancel' then
  delete from public.telegram_homework_sessions where telegram_user_id=p_user_id;
  result := 'cancelled';
 elsif p_action='grade' and s.step='grade' and p_value ~ '^(7|8|9|10|11|12)$' then
  update public.telegram_homework_sessions set grade=p_value::smallint,step='class' where telegram_user_id=p_user_id;
  result := 'class';
 elsif p_action='class' and s.step='class' and p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  chosen := p_value::uuid;
  if exists(select 1 from public.classes where id=chosen and grade=s.grade) then
   update public.telegram_homework_sessions set class_id=chosen,step='subject' where telegram_user_id=p_user_id;
   result := 'subject';
  end if;
 elsif p_action='subject' and s.step='subject' and p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  chosen := p_value::uuid;
  if exists(select 1 from public.subjects where id=chosen) and exists(select 1 from public.weekly_schedule where class_id=s.class_id and subject_id=chosen) then
   update public.telegram_homework_sessions set subject_id=chosen,step='date' where telegram_user_id=p_user_id;
   result := 'date';
  end if;
 elsif p_action='date' and s.step='date' and p_value in ('today','tomorrow','dayafter') then
  update public.telegram_homework_sessions set due_date=local_today + case p_value when 'today' then 0 when 'tomorrow' then 1 else 2 end,step='body'
   where telegram_user_id=p_user_id;
  result := 'body';
 elsif p_action='body' and s.step='body' then
  if p_value is not null and char_length(btrim(p_value)) between 1 and 1000 then
   update public.telegram_homework_sessions set body=btrim(p_value),step='confirm' where telegram_user_id=p_user_id;
   result := 'confirm';
  else result := 'body_invalid'; end if;
 elsif p_action='edit' and s.step='confirm' then
  update public.telegram_homework_sessions set body=null,step='body' where telegram_user_id=p_user_id;
  result := 'body';
 elsif p_action='publish' and s.step='confirm' then
  select grade into g from public.classes where id=s.class_id for share;
  perform 1 from public.subjects where id=s.subject_id for share;
  if found and g=s.grade and s.due_date between local_today-366 and local_today+366
   and s.body is not null and char_length(btrim(s.body)) between 1 and 1000 then
   perform 1 from public.weekly_schedule where class_id=s.class_id and subject_id=s.subject_id for share;
   if found then
    perform 1 from public.profiles where id=p_author for share;
    if found then
     if (select count(*) from public.telegram_homework_updates
         where telegram_user_id=p_user_id and outcome='published' and created_at>now()-interval '24 hours')>=10 then
      result := 'rate_limited';
     else
      insert into public.class_homework(class_id,subject_id,due_date,body,created_by)
      values(s.class_id,s.subject_id,s.due_date,btrim(s.body),p_author) returning id into published;
      delete from public.telegram_homework_sessions where telegram_user_id=p_user_id;
      result := 'published';
     end if;
    end if;
   end if;
  end if;
 end if;

 if result in ('class','subject','date','body','confirm') then
  update public.telegram_homework_sessions set token=substr(replace(gen_random_uuid()::text,'-',''),1,12),
   last_update_id=p_update_id,updated_at=now(),expires_at=now()+interval '30 minutes' where telegram_user_id=p_user_id;
 end if;
 update public.telegram_homework_updates set outcome=result,homework_id=published where update_id=p_update_id;
 return result;
end $$;
-- Replacing the function retains privileges; make the intended boundary explicit.
revoke all on function public.telegram_homework_apply_update(bigint,bigint,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.telegram_homework_apply_update(bigint,bigint,text,text,text,uuid) to service_role;
comment on function public.telegram_homework_apply_update(bigint,bigint,text,text,text,uuid) is
 'Trusted public Telegram boundary: webhook validates its secret and private sender context; RPC enforces per-user publication quota and idempotency.';
commit;
