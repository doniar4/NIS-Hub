-- Additive: legacy public.schedule is retained; dates are NOT guessed into weeks.
begin;
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create table public.weekly_schedule (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 5),
  lesson_start smallint not null check (lesson_start between 1 and 20),
  lesson_end smallint not null check (lesson_end between lesson_start and 20),
  start_time time, end_time time,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  teacher text check (teacher is null or length(btrim(teacher)) between 1 and 100),
  room text check (room is null or length(btrim(room)) between 1 and 40),
  effective_from date, effective_to date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((start_time is null and end_time is null) or
    (start_time is not null and end_time is not null and end_time > start_time)),
  check (effective_to is null or effective_from is null or effective_to >= effective_from),
  constraint weekly_schedule_slot unique nulls not distinct (class_id,weekday,lesson_start,effective_from),
  -- Database-level exclusion also protects concurrent writers and direct SQL/API.
  constraint weekly_schedule_no_overlap exclude using gist (
    class_id with =, weekday with =,
    int4range(lesson_start, lesson_end, '[]') with &&,
    daterange(effective_from, effective_to, '[]') with &&
  ) deferrable initially immediate,
  constraint weekly_schedule_no_time_overlap exclude using gist (
    class_id with =, weekday with =,
    tsrange(date '2000-01-01' + start_time, date '2000-01-01' + end_time, '[)') with &&,
    daterange(effective_from, effective_to, '[]') with &&
  ) where (start_time is not null) deferrable initially immediate
);
create function private.weekly_lesson_end() returns trigger language plpgsql set search_path='' as $$
begin new.lesson_end := coalesce(new.lesson_end,new.lesson_start); return new; end;
$$;
revoke all on function private.weekly_lesson_end() from public;
create trigger weekly_default_end before insert or update on public.weekly_schedule
for each row execute function private.weekly_lesson_end();
alter table public.weekly_schedule enable row level security;
revoke all on public.weekly_schedule from anon;
grant select, insert, update, delete on public.weekly_schedule to authenticated;
create policy "Signed in users read weekly schedule" on public.weekly_schedule for select to authenticated using (true);
create policy "Admins manage weekly schedule" on public.weekly_schedule for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create trigger weekly_schedule_updated before update on public.weekly_schedule
for each row execute function public.set_updated_at();
comment on table public.schedule is 'Legacy date-based schedule retained for history. Phase 4 UI uses weekly_schedule.';

create function public.import_weekly_schedule(p_lessons jsonb)
returns integer language plpgsql security invoker set search_path='' as $$
declare row jsonb; total integer;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_lessons is null or jsonb_typeof(p_lessons)<>'array' then
    raise exception 'Invalid import' using errcode='23514';
  end if;
  total := jsonb_array_length(p_lessons);
  if total not between 1 and 1000 or octet_length(p_lessons::text)>1048576 then
    raise exception 'Import limit' using errcode='23514';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lessons) r
    group by (r->>'class_id')::uuid,(r->>'weekday')::smallint,
      (r->>'lesson_start')::smallint,nullif(r->>'effective_from','')::date
    having count(*)>1
  ) then raise exception 'Duplicate slots' using errcode='23514'; end if;
  set constraints public.weekly_schedule_no_overlap, public.weekly_schedule_no_time_overlap deferred;
  for row in select value from jsonb_array_elements(p_lessons) loop
    insert into public.weekly_schedule(class_id,weekday,lesson_start,lesson_end,start_time,end_time,subject_id,teacher,room,effective_from,effective_to)
    values ((row->>'class_id')::uuid,(row->>'weekday')::smallint,(row->>'lesson_start')::smallint,
      coalesce(nullif(row->>'lesson_end','')::smallint,(row->>'lesson_start')::smallint),
      nullif(row->>'start_time','')::time,nullif(row->>'end_time','')::time,(row->>'subject_id')::uuid,
      nullif(btrim(row->>'teacher'),''),nullif(btrim(row->>'room'),''),
      nullif(row->>'effective_from','')::date,nullif(row->>'effective_to','')::date)
    on conflict on constraint weekly_schedule_slot do update
      set lesson_end=excluded.lesson_end,start_time=excluded.start_time,end_time=excluded.end_time,
          subject_id=excluded.subject_id,teacher=excluded.teacher,room=excluded.room,effective_to=excluded.effective_to
      where (weekly_schedule.lesson_end,weekly_schedule.start_time,weekly_schedule.end_time,
        weekly_schedule.subject_id,weekly_schedule.teacher,weekly_schedule.room,weekly_schedule.effective_to)
        is distinct from
        (excluded.lesson_end,excluded.start_time,excluded.end_time,excluded.subject_id,excluded.teacher,excluded.room,excluded.effective_to);
  end loop;
  set constraints public.weekly_schedule_no_overlap, public.weekly_schedule_no_time_overlap immediate;
  return total;
end;
$$;
revoke all on function public.import_weekly_schedule(jsonb) from public, anon;
grant execute on function public.import_weekly_schedule(jsonb) to authenticated;
commit;
