begin;

-- Frequent last-seen lookups are bounded to one indexed row per returned user.
-- Existing indexes cover created_at range scans; do not index every filter.
create index if not exists admin_activity_user_recent
 on public.user_activity_logs(user_id,created_at desc,id desc);
create index if not exists admin_telegram_homework_source
 on public.telegram_homework_updates(homework_id) where outcome='published' and homework_id is not null;

-- No profile/table grants or policies are broadened. Reporting returns a
-- selected set of fields only to a currently authenticated database admin.
create function public.admin_control_read(p_section text,p_filters jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
 result jsonb; cid uuid; uid uuid; off integer; query text; active text; role_filter text;
 day_start timestamptz := date_trunc('day',now() at time zone 'Asia/Oral') at time zone 'Asia/Oral';
 week_start timestamptz := now()-interval '7 days';
 chart_start timestamptz; chart_end timestamptz; stride interval; span text; status_filter text; sid uuid; due date; origin text;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'admin_required' using errcode='42501'; end if;
 if p_filters is null or jsonb_typeof(p_filters)<>'object' or octet_length(p_filters::text)>2048 then raise exception 'invalid_input'; end if;
 cid := nullif(p_filters->>'class','')::uuid; uid := nullif(p_filters->>'user','')::uuid;
 off := coalesce(nullif(p_filters->>'offset','')::integer,0);
 if off<0 or off>10000 then raise exception 'invalid_input'; end if;

 if p_section='stats' then
  select jsonb_build_object(
   'online',(select count(distinct user_id) from public.user_activity_logs where created_at>=now()-interval '15 minutes'),
   'today',(select count(distinct user_id) from public.user_activity_logs where created_at>=day_start),
   'totalUsers',(select count(*) from public.profiles),
   'newUsers',(select count(*) from public.profiles where created_at>=day_start),
   'homeworkToday',(select count(*) from public.class_homework where created_at>=day_start and deleted_at is null),
   'openTickets',(select count(*) from public.support_tickets where status in('open','in_progress'))
  ) into result;
 elsif p_section='registrations' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into result from (
   select p.id,p.display_name,c.name as class_name,p.created_at from public.profiles p
   left join public.classes c on c.id=p.class_id order by p.created_at desc,p.id limit 8
  ) r;
 elsif p_section='classes' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into result from (
   select c.id,c.name,count(p.id) as registered,count(p.id) filter(where a.user_id is not null) as active
   from public.classes c left join public.profiles p on p.class_id=c.id
   left join (select distinct user_id from public.user_activity_logs where created_at>=day_start) a on a.user_id=p.id
   group by c.id order by count(p.id) desc,c.grade,c.section,c.name limit 25 offset off
  ) r;
 elsif p_section='users' then
  query:=left(btrim(coalesce(p_filters->>'q','')),60); active:=coalesce(p_filters->>'active',''); role_filter:=coalesce(p_filters->>'role','');
  if active not in('','today','week','online') or role_filter not in('','student','admin') then raise exception 'invalid_input'; end if;
  with matched as materialized (
   select p.id,p.display_name,p.class_id,c.name as class_name,p.role,p.created_at
   from public.profiles p left join public.classes c on c.id=p.class_id
   where (cid is null or p.class_id=cid) and (uid is null or p.id=uid)
   and (query='' or strpos(lower(coalesce(p.display_name,'')),lower(query))>0)
   and (role_filter='' or p.role::text=role_filter)
   and (active='' or exists(select 1 from public.user_activity_logs a where a.user_id=p.id
    and a.created_at>=case active when 'online' then now()-interval '15 minutes' when 'today' then day_start else week_start end))
  ), page as (
   select * from matched order by created_at desc,id limit 25 offset off
  ), rows as (
   select p.*,a.created_at as last_activity,a.user_agent from page p
   left join lateral(select created_at,user_agent from public.user_activity_logs where user_id=p.id order by created_at desc,id desc limit 1) a on true
  ) select jsonb_build_object('total',(select count(*) from matched),'rows',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id) from rows r),'[]')) into result;
 elsif p_section='feed' then
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into result from (
   select a.id,a.user_id,p.display_name,c.name as class_name,a.path,a.user_agent,a.created_at
   from public.user_activity_logs a left join public.profiles p on p.id=a.user_id left join public.classes c on c.id=p.class_id
   where (cid is null or p.class_id=cid) and (uid is null or a.user_id=uid)
   order by a.created_at desc,a.id desc limit 25 offset off
  ) r;
 elsif p_section='activity' then
  with events as materialized (
   select a.user_id,a.created_at,a.user_agent,a.id from public.user_activity_logs a
   join public.profiles p on p.id=a.user_id where a.created_at>=week_start and (cid is null or p.class_id=cid)
  ), latest as (select distinct on(user_id) user_agent from events order by user_id,created_at desc,id desc), categories as (
   select case when user_agent ~* 'iPhone|iPad|iPod' then 'iPhone/iOS' when user_agent ~* 'Android' then 'Android'
    when user_agent ~* 'Macintosh|Mac OS' then 'Mac' when user_agent ~* 'Windows' then 'Windows' else 'Other' end as device,
    case when user_agent ~* 'Edg(e|A|iOS)?/' then 'Edge' when user_agent ~* 'Firefox|FxiOS' then 'Firefox'
     when user_agent ~* 'Chrome|CriOS|Chromium' then 'Chrome' when user_agent ~* 'Safari' then 'Safari' else 'Other' end as browser from latest
  )
  select jsonb_build_object(
   'online',(select count(distinct user_id) from events where created_at>=now()-interval '15 minutes'),
   'today',(select count(distinct user_id) from events where created_at>=day_start),
   'week',(select count(distinct user_id) from events),
   'agents',coalesce((select jsonb_agg(to_jsonb(r)) from (select device,browser,count(*) as count from categories group by device,browser order by device,browser) r),'[]')
  ) into result;
 elsif p_section='chart' then
  span:=coalesce(p_filters->>'range','24h');
  if span not in('24h','7d','30d') then raise exception 'invalid_input'; end if;
  stride:=case when span='24h' then interval '1 hour' else interval '1 day' end;
  chart_end:=case when span='24h' then date_trunc('hour',now()) else day_start end;
  chart_start:=chart_end-case span when '24h' then interval '23 hours' when '7d' then interval '6 days' else interval '29 days' end;
  with points as (select generate_series(chart_start,chart_end,stride) as bucket), grouped as (
   select date_bin(stride,a.created_at,chart_start) as bucket,count(distinct a.user_id) as count
   from public.user_activity_logs a join public.profiles p on p.id=a.user_id
   where a.created_at>=chart_start and a.created_at<chart_end+stride and (cid is null or p.class_id=cid)
   group by 1
  ) select jsonb_agg(jsonb_build_object('at',p.bucket,'count',coalesce(g.count,0)) order by p.bucket) into result
   from points p left join grouped g using(bucket);
 elsif p_section='homeworkStats' then
  select jsonb_build_object(
   'today',count(*) filter(where h.created_at>=day_start),'week',count(*) filter(where h.created_at>=week_start),
   'authors',count(distinct h.created_by),'visible',count(*) filter(where h.moderation_status='visible'),
   'hidden',count(*) filter(where h.moderation_status='hidden'),
   'telegram',count(*) filter(where exists(select 1 from public.telegram_homework_updates u where u.homework_id=h.id and u.outcome='published'))
  ) into result from public.class_homework h where deleted_at is null;
 elsif p_section='homework' then
  sid:=nullif(p_filters->>'subject','')::uuid; due:=nullif(p_filters->>'due','')::date;
  status_filter:=coalesce(p_filters->>'status',''); origin:=coalesce(p_filters->>'source','');
  if status_filter not in('','visible','hidden') or origin not in('','telegram','unknown') then raise exception 'invalid_input'; end if;
  with matched as materialized (
   select h.*,exists(select 1 from public.telegram_homework_updates u where u.homework_id=h.id and u.outcome='published') as telegram
   from public.class_homework h where h.deleted_at is null and (cid is null or h.class_id=cid)
    and (sid is null or h.subject_id=sid) and (due is null or h.due_date=due)
    and (status_filter='' or h.moderation_status=status_filter)
  ), filtered as (
   select * from matched where origin='' or (origin='telegram' and telegram) or (origin='unknown' and not telegram)
  ) select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(r)) from
   (select * from filtered order by due_date desc,created_at desc,id limit 25 offset off) r),'[]')) into result;
 elsif p_section='tickets' then
  select jsonb_build_object(
   'open',(select count(*) from public.support_tickets where status in('open','in_progress')),
   'waiting',(select count(*) from public.support_tickets where needs_admin_reply and status in('open','in_progress')),
   'resolved',(select count(distinct ticket_id) from public.support_status_events where status='resolved' and created_at>=day_start)
  ) into result;
 else raise exception 'invalid_input'; end if;
 return result;
end $$;
revoke all on function public.admin_control_read(text,jsonb) from public,anon;
grant execute on function public.admin_control_read(text,jsonb) to authenticated;

create function public.admin_update_user(p_user uuid,p_class uuid,p_role text,p_expected_role text,p_confirm boolean)
returns void language plpgsql security definer set search_path='' as $$
declare previous text;
begin
 -- Serialize ALL role mutations before rechecking authorization and the count.
 -- This protects concurrent demotions; client confirmation alone is insufficient.
 perform pg_advisory_xact_lock(160610,1);
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='admin') then
  raise exception 'admin_required' using errcode='42501';
 end if;
 if p_confirm is distinct from true or p_role is null or p_role not in('student','admin')
  or p_expected_role is null or p_expected_role not in('student','admin') then raise exception 'invalid_input'; end if;
 if p_class is not null and not exists(select 1 from public.classes where id=p_class) then raise exception 'invalid_input'; end if;
 select role::text into previous from public.profiles where id=p_user for update;
 if previous is null then raise exception 'unavailable'; end if;
 if previous<>p_expected_role then raise exception 'stale'; end if;
 if previous='admin' and p_role='student' and (select count(*) from public.profiles where role='admin')<=1 then raise exception 'last_admin'; end if;
 update public.profiles set class_id=p_class,role=p_role::public.profile_role,updated_at=now() where id=p_user;
end $$;
revoke all on function public.admin_update_user(uuid,uuid,text,text,boolean) from public,anon;
grant execute on function public.admin_update_user(uuid,uuid,text,text,boolean) to authenticated;

commit;
