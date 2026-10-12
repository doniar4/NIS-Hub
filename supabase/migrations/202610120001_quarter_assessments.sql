begin;

-- Dated overlays survive regular timetable imports and EduPage syncs.
create table public.assessment_schedule (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  date date not null check (extract(isodow from date) between 1 and 5),
  lesson_start integer not null check (lesson_start between 1 and 20),
  lesson_end integer not null check (lesson_end between lesson_start and 20),
  subject_id uuid references public.subjects(id) on delete set null,
  subject_label text not null check (length(btrim(subject_label)) between 1 and 300),
  duration_minutes integer check (duration_minutes between 1 and 240),
  source_file text not null check (length(source_file) between 1 and 255),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default clock_timestamp(),
  exclude using gist (class_id with =,date with =,int4range(lesson_start,lesson_end,'[]') with &&)
);
create index assessment_schedule_class_date on public.assessment_schedule(class_id,date);
alter table public.assessment_schedule enable row level security;
revoke all on public.assessment_schedule from public,anon,authenticated;
grant select on public.assessment_schedule to authenticated;
create policy "View quarter assessments" on public.assessment_schedule for select to authenticated using (true);

create function public.import_assessment_schedule(p_lessons jsonb,p_days jsonb,p_source_file text)
returns integer language plpgsql security definer set search_path='' as $$
declare total integer;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_lessons is null or jsonb_typeof(p_lessons)<>'array' or jsonb_array_length(p_lessons) not between 1 and 10000
    or p_days is null or jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days) not between 1 and 10000
    or p_source_file is null or length(p_source_file) not between 1 and 255 then
    raise exception 'Invalid assessment import' using errcode='23514';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(505,2);
  if exists (
    select 1 from jsonb_to_recordset(p_days) as d(class_id uuid,date date)
    left join public.classes c on c.id=d.class_id
    where c.id is null or d.date is null or extract(isodow from d.date) not between 1 and 5
  ) or exists (
    select 1 from jsonb_to_recordset(p_lessons) as l(class_id uuid,date date)
    where not exists (select 1 from jsonb_to_recordset(p_days) as d(class_id uuid,date date)
      where d.class_id=l.class_id and d.date=l.date)
  ) then raise exception 'Invalid assessment days' using errcode='23514'; end if;

  -- Full replacement within the uploaded class/date scope also removes cells
  -- cleared in a corrected workbook. Unrelated classes and dates stay intact.
  delete from public.assessment_schedule a using jsonb_to_recordset(p_days) as d(class_id uuid,date date)
    where a.class_id=d.class_id and a.date=d.date;
  insert into public.assessment_schedule(class_id,date,lesson_start,lesson_end,subject_id,subject_label,duration_minutes,source_file)
  select l.class_id,l.date,l.lesson_start,l.lesson_end,l.subject_id,l.subject_label,l.duration_minutes,p_source_file
  from jsonb_to_recordset(p_lessons) as l(class_id uuid,date date,lesson_start integer,lesson_end integer,subject_id uuid,subject_label text,duration_minutes integer);
  get diagnostics total = row_count;
  return total;
end;
$$;
create function public.clear_assessment_schedule(p_dates date[])
returns integer language plpgsql security definer set search_path='' as $$
declare total integer;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_dates is null or cardinality(p_dates) not between 1 and 100 or array_position(p_dates,null) is not null then
    raise exception 'Invalid assessment dates' using errcode='23514';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(505,2);
  delete from public.assessment_schedule where date=any(p_dates);
  get diagnostics total = row_count;
  return total;
end;
$$;
revoke all on function public.import_assessment_schedule(jsonb,jsonb,text),public.clear_assessment_schedule(date[]) from public,anon;
grant execute on function public.import_assessment_schedule(jsonb,jsonb,text),public.clear_assessment_schedule(date[]) to authenticated;
commit;
