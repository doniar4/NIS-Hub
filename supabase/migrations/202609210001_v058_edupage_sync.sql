-- v0.5.8: extend existing schedule, preserving rows, RLS and immutable history.
begin;
alter table public.weekly_schedule
  add column subgroup_key text not null default '' check(length(subgroup_key)<=240),
  add column subgroup_label text check(length(subgroup_label) between 1 and 200),
  add column audience int4multirange not null default '{(,)}',
  add constraint weekly_subgroup_shape check(
    (subgroup_key='' and subgroup_label is null and audience='{(,)}'::int4multirange) or
    (length(subgroup_key)>0 and subgroup_label is not null and not isempty(audience)
      and audience <@ '{[0,256)}'::int4multirange)
  );
-- Audience cells represent possible combinations of independent class divisions.
-- Whole-class rows intersect every subgroup. Existing rows keep whole-class scope.
alter table public.weekly_schedule drop constraint weekly_schedule_slot,
  drop constraint weekly_schedule_no_overlap, drop constraint weekly_schedule_no_time_overlap;
alter table public.weekly_schedule
  add constraint weekly_schedule_slot unique nulls not distinct (class_id,weekday,lesson_start,effective_from,subgroup_key),
  add constraint weekly_schedule_no_overlap exclude using gist (
    class_id with =,weekday with =,audience with &&,
    int4range(lesson_start,lesson_end,'[]') with &&,
    daterange(effective_from,effective_to,'[]') with &&
  ) deferrable initially immediate,
  add constraint weekly_schedule_no_time_overlap exclude using gist (
    class_id with =,weekday with =,audience with &&,
    tsrange(date '2000-01-01'+start_time,date '2000-01-01'+end_time,'[)') with &&,
    daterange(effective_from,effective_to,'[]') with &&
  ) where(start_time is not null) deferrable initially immediate;

alter table public.schedule_import_batches drop constraint schedule_import_batches_source_type_check;
alter table public.schedule_import_batches add constraint schedule_import_batches_source_type_check
  check(source_type in('baseline','csv_tsv','delete','restore','edupage'));

-- The original manual import uses this same validated upsert with default whole-
-- class audience. Its 1,000-row limit and public versioned wrapper are unchanged.
create or replace function private.import_weekly_schedule(p_lessons jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare row jsonb; total integer;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_lessons is null or jsonb_typeof(p_lessons)<>'array' then raise exception 'Invalid import' using errcode='23514'; end if;
  total:=jsonb_array_length(p_lessons);
  if total not between 1 and 1000 or octet_length(p_lessons::text)>1048576 then raise exception 'Import limit' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_lessons) r group by
    (r->>'class_id')::uuid,(r->>'weekday')::smallint,(r->>'lesson_start')::smallint,
    nullif(r->>'effective_from','')::date,coalesce(r->>'subgroup_key','') having count(*)>1)
    then raise exception 'Duplicate slots' using errcode='23514'; end if;
  set constraints public.weekly_schedule_no_overlap,public.weekly_schedule_no_time_overlap deferred;
  for row in select value from jsonb_array_elements(p_lessons) loop
    insert into public.weekly_schedule(class_id,weekday,lesson_start,lesson_end,start_time,end_time,
      subject_id,teacher,room,effective_from,effective_to,subgroup_key,subgroup_label,audience)
    values((row->>'class_id')::uuid,(row->>'weekday')::smallint,(row->>'lesson_start')::smallint,
      coalesce(nullif(row->>'lesson_end','')::smallint,(row->>'lesson_start')::smallint),
      nullif(row->>'start_time','')::time,nullif(row->>'end_time','')::time,(row->>'subject_id')::uuid,
      nullif(btrim(row->>'teacher'),''),nullif(btrim(row->>'room'),''),
      nullif(row->>'effective_from','')::date,nullif(row->>'effective_to','')::date,
      coalesce(row->>'subgroup_key',''),nullif(row->>'subgroup_label',''),
      coalesce(nullif(row->>'audience','')::int4multirange,'{(,)}'::int4multirange))
    on conflict on constraint weekly_schedule_slot do update set
      lesson_end=excluded.lesson_end,start_time=excluded.start_time,end_time=excluded.end_time,
      subject_id=excluded.subject_id,teacher=excluded.teacher,room=excluded.room,effective_to=excluded.effective_to,
      subgroup_label=excluded.subgroup_label,audience=excluded.audience
    where (weekly_schedule.lesson_end,weekly_schedule.start_time,weekly_schedule.end_time,weekly_schedule.subject_id,
      weekly_schedule.teacher,weekly_schedule.room,weekly_schedule.effective_to,weekly_schedule.subgroup_label,weekly_schedule.audience)
    is distinct from (excluded.lesson_end,excluded.start_time,excluded.end_time,excluded.subject_id,
      excluded.teacher,excluded.room,excluded.effective_to,excluded.subgroup_label,excluded.audience);
  end loop;
  set constraints public.weekly_schedule_no_overlap,public.weekly_schedule_no_time_overlap immediate;
  return total;
end;
$$;

-- Older snapshots lack the new fields. Fill defaults without rewriting history.
create or replace function public.restore_schedule_version(p_id uuid,p_expected_active uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare payload jsonb; current_id uuid; result uuid;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(505,1);
  select id into current_id from public.schedule_import_batches where status='active' for update;
  if current_id is distinct from p_expected_active or current_id=p_id then
    raise exception 'Active version changed; compare again' using errcode='23514'; end if;
  select snapshot into payload from public.schedule_import_batches where id=p_id;
  if payload is null then raise exception 'Version not found' using errcode='23514'; end if;
  delete from public.weekly_schedule;
  insert into public.weekly_schedule
    select * from jsonb_populate_recordset(null::public.weekly_schedule,
      (select coalesce(jsonb_agg('{"subgroup_key":"","subgroup_label":null,"audience":"{(,)}"}'::jsonb || r),'[]'::jsonb)
       from jsonb_array_elements(payload) r));
  result:=private.record_schedule_version('restore','Restored version: '||p_id,p_id);
  return result;
end;
$$;

-- Configuration/status only, never another student-serving timetable.
create table public.edupage_sync_state (
  id boolean primary key default true check(id),
  aliases jsonb not null default '{"classes":{},"subjects":{}}'
    check(jsonb_typeof(aliases)='object' and octet_length(aliases::text)<=200000),
  last_checked timestamptz,
  last_synced timestamptz,
  last_error text check(last_error in('disabled','login_required','unavailable','timeout','source_changed',
    'unsupported','mapping','conflict','stale','confirmation','database','admin','busy')),
  publication text check(length(publication)<=200),
  version_id uuid references public.schedule_import_batches(id) on delete restrict
);
alter table public.edupage_sync_state enable row level security;
revoke all on public.edupage_sync_state from public,anon,authenticated;
grant select,insert,update on public.edupage_sync_state to authenticated;
create policy "Admins manage EduPage source state" on public.edupage_sync_state for all to authenticated
  using(public.is_admin()) with check(public.is_admin());

create function public.sync_edupage_schedule(p_lessons jsonb,p_classes uuid[],p_expected_active uuid,
  p_note text,p_aliases jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare active_id uuid; result uuid; total integer; batch jsonb; offset_rows integer;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(505,1);
  select id into active_id from public.schedule_import_batches where status='active' for update;
  if active_id is distinct from p_expected_active then raise exception 'Active version changed' using errcode='40001'; end if;
  if p_lessons is null or jsonb_typeof(p_lessons)<>'array' then raise exception 'Invalid import' using errcode='23514'; end if;
  total:=jsonb_array_length(p_lessons);
  if total not between 1 and 10000 or octet_length(p_lessons::text)>8388608
    or coalesce(cardinality(p_classes),0) not between 1 and 200 or length(p_note)>200 then
    raise exception 'Import limit' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(p_lessons) r where not ((r->>'class_id')::uuid=any(p_classes)) or r->>'class_id' is null)
    or exists(select 1 from unnest(p_classes) c where c is null or not exists(
      select 1 from jsonb_array_elements(p_lessons) r where (r->>'class_id')::uuid=c))
    or exists(select 1 from jsonb_array_elements(p_lessons) r group by
      (r->>'class_id')::uuid,(r->>'weekday')::smallint,(r->>'lesson_start')::smallint,
      nullif(r->>'effective_from','')::date,coalesce(r->>'subgroup_key','') having count(*)>1)
    then raise exception 'Invalid scope or duplicate slot' using errcode='23514'; end if;
  -- Preview explicitly covers replacement of ALL rows of selected classes.
  -- Nothing becomes visible until every chunk + immutable snapshot commits.
  delete from public.weekly_schedule where class_id=any(p_classes);
  offset_rows:=0;
  while offset_rows<total loop
    select jsonb_agg(value order by ordinal) into batch from
      jsonb_array_elements(p_lessons) with ordinality as r(value,ordinal)
      where ordinal>offset_rows and ordinal<=offset_rows+1000;
    perform private.import_weekly_schedule(batch);
    offset_rows:=offset_rows+1000;
  end loop;
  result:=private.record_schedule_version('edupage',p_note);
  insert into public.edupage_sync_state(id,aliases,last_checked,last_synced,last_error,publication,version_id)
    values(true,p_aliases,clock_timestamp(),clock_timestamp(),null,p_note,result)
    on conflict(id) do update set aliases=excluded.aliases,last_checked=excluded.last_checked,
      last_synced=excluded.last_synced,last_error=null,publication=excluded.publication,version_id=result;
  return result;
end;
$$;
revoke all on function public.sync_edupage_schedule(jsonb,uuid[],uuid,text,jsonb) from public,anon;
grant execute on function public.sync_edupage_schedule(jsonb,uuid[],uuid,text,jsonb) to authenticated;
-- Existing function privileges and schedule RLS are deliberately unchanged.
commit;
