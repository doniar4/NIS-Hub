begin;
create table public.assessment_periods (
  id uuid primary key default gen_random_uuid(),
  academic_year integer not null check (academic_year between 2000 and 2100),
  quarter integer not null check (quarter between 1 and 4),
  revision_id uuid not null default gen_random_uuid(),
  source_file text not null default '' check (length(source_file)<=255),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default clock_timestamp(),
  unique(academic_year,quarter)
);
alter table public.assessment_periods enable row level security;
revoke all on public.assessment_periods from public,anon,authenticated;
grant select on public.assessment_periods to authenticated;
create policy "View assessment periods" on public.assessment_periods for select to authenticated using(true);
alter table public.assessment_schedule add column period_id uuid references public.assessment_periods(id) on delete cascade;

-- Attach legacy dated imports to a school year and its usual assessment season.
insert into public.assessment_periods(academic_year,quarter)
select distinct extract(year from date)::integer-case when extract(month from date)<9 then 1 else 0 end,
  case when extract(month from date) in(9,10) then 1 when extract(month from date) in(11,12) then 2 when extract(month from date) in(1,2,3) then 3 else 4 end
from public.assessment_schedule;
update public.assessment_schedule a set period_id=p.id from public.assessment_periods p
where p.academic_year=extract(year from a.date)::integer-case when extract(month from a.date)<9 then 1 else 0 end
and p.quarter=case when extract(month from a.date) in(9,10) then 1 when extract(month from a.date) in(11,12) then 2 when extract(month from a.date) in(1,2,3) then 3 else 4 end;
alter table public.assessment_schedule alter column period_id set not null;
create index assessment_schedule_period_class on public.assessment_schedule(period_id,class_id);

create function public.import_quarter_assessments(p_lessons jsonb,p_days jsonb,p_source_file text,p_academic_year integer,p_quarter integer,p_expected_revision uuid)
returns integer language plpgsql security definer set search_path='' as $$
declare period uuid; revision uuid; total integer;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_academic_year is null or p_academic_year not between 2000 and 2100 or p_quarter is null or p_quarter not between 1 and 4
    or p_lessons is null or jsonb_typeof(p_lessons)<>'array' or jsonb_array_length(p_lessons) not between 1 and 10000
    or p_days is null or jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days) not between 1 and 10000
    or p_source_file is null or length(p_source_file) not between 1 and 255 then raise exception 'Invalid assessment import' using errcode='23514'; end if;
  perform pg_catalog.pg_advisory_xact_lock(505,2);
  select id,revision_id into period,revision from public.assessment_periods where academic_year=p_academic_year and quarter=p_quarter for update;
  if revision is distinct from p_expected_revision then raise exception 'Assessment revision changed' using errcode='23514'; end if;
  if exists(select 1 from jsonb_to_recordset(p_days) as d(class_id uuid,date date)
    left join public.classes c on c.id=d.class_id where c.id is null or d.date is null
    or d.date<make_date(p_academic_year,9,1) or d.date>make_date(p_academic_year+1,8,31) or extract(isodow from d.date) not between 1 and 5)
    or exists(select 1 from jsonb_to_recordset(p_lessons) as l(class_id uuid,date date)
      where not exists(select 1 from jsonb_to_recordset(p_days) as d(class_id uuid,date date) where d.class_id=l.class_id and d.date=l.date))
    then raise exception 'Invalid assessment days' using errcode='23514'; end if;
  if period is null then
    insert into public.assessment_periods(academic_year,quarter) values(p_academic_year,p_quarter) returning id into period;
  end if;
  -- Replacing a quarter for the uploaded classes also removes old dates when
  -- an exam moves. Other quarters and classes keep their own schedules.
  delete from public.assessment_schedule a where a.period_id=period and a.class_id in
    (select d.class_id from jsonb_to_recordset(p_days) as d(class_id uuid,date date));
  insert into public.assessment_schedule(period_id,class_id,date,lesson_start,lesson_end,subject_id,subject_label,duration_minutes,source_file)
  select period,l.class_id,l.date,l.lesson_start,l.lesson_end,l.subject_id,l.subject_label,l.duration_minutes,p_source_file
  from jsonb_to_recordset(p_lessons) as l(class_id uuid,date date,lesson_start integer,lesson_end integer,subject_id uuid,subject_label text,duration_minutes integer);
  get diagnostics total = row_count;
  update public.assessment_periods set revision_id=gen_random_uuid(),source_file=p_source_file,updated_by=auth.uid(),updated_at=clock_timestamp() where id=period;
  return total;
end;
$$;

create or replace function public.clear_assessment_schedule(p_dates date[])
returns integer language plpgsql security definer set search_path='' as $$
declare total integer; periods uuid[];
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_dates is null or cardinality(p_dates) not between 1 and 100 or array_position(p_dates,null) is not null then raise exception 'Invalid assessment dates' using errcode='23514'; end if;
  perform pg_catalog.pg_advisory_xact_lock(505,2);
  select array_agg(distinct period_id) into periods from public.assessment_schedule where date=any(p_dates);
  delete from public.assessment_schedule where date=any(p_dates);
  get diagnostics total = row_count;
  update public.assessment_periods set revision_id=gen_random_uuid(),updated_by=auth.uid(),updated_at=clock_timestamp() where id=any(periods);
  return total;
end;
$$;
revoke all on function public.import_assessment_schedule(jsonb,jsonb,text) from authenticated;
revoke all on function public.import_quarter_assessments(jsonb,jsonb,text,integer,integer,uuid) from public,anon;
grant execute on function public.import_quarter_assessments(jsonb,jsonb,text,integer,integer,uuid) to authenticated;
commit;
