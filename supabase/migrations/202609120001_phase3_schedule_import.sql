-- Additive admin-only manual import. Does not change RLS or delete schedule rows.
begin;
create function public.import_schedule(p_lessons jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare item jsonb;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if p_lessons is null or jsonb_typeof(p_lessons) <> 'array' then raise exception 'Invalid import'; end if;
  if jsonb_array_length(p_lessons) not between 1 and 500 or octet_length(p_lessons::text) > 262144 then raise exception 'Import too large or empty'; end if;
  for item in select value from jsonb_array_elements(p_lessons) loop
    if jsonb_typeof(item) <> 'object' then raise exception 'Invalid lesson'; end if;
    if exists(select 1 from jsonb_object_keys(item) k where k not in ('class_id','date','lesson_number','subject_id','teacher','room')) then raise exception 'Unknown lesson field'; end if;
    if jsonb_typeof(item->'class_id') is distinct from 'string' or jsonb_typeof(item->'subject_id') is distinct from 'string'
      or jsonb_typeof(item->'date') is distinct from 'string' or (item->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or jsonb_typeof(item->'lesson_number') is distinct from 'number' then raise exception 'Invalid lesson fields'; end if;
    if (item->>'lesson_number')::numeric not between 1 and 20
      or trunc((item->>'lesson_number')::numeric) <> (item->>'lesson_number')::numeric then raise exception 'Invalid lesson number'; end if;
    if (item ? 'teacher' and jsonb_typeof(item->'teacher') not in ('string','null')) or length(btrim(item->>'teacher')) > 100
      or (item ? 'room' and jsonb_typeof(item->'room') not in ('string','null')) or length(btrim(item->>'room')) > 40
      then raise exception 'Invalid optional fields'; end if;
    -- PostgreSQL validates UUIDs and real dates, even for a direct RPC caller.
    perform (item->>'class_id')::uuid, (item->>'subject_id')::uuid, (item->>'date')::date;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_lessons) r
    group by (r->>'class_id')::uuid, (r->>'date')::date, (r->>'lesson_number')::numeric having count(*) > 1)
    then raise exception 'Duplicate lesson slot'; end if;
  -- Deterministic order reduces lock-order conflicts for simultaneous imports.
  for item in select value from jsonb_array_elements(p_lessons)
    order by value->>'class_id', value->>'date', (value->>'lesson_number')::numeric loop
    insert into public.schedule(class_id,date,lesson_number,subject_id,teacher,room)
    values ((item->>'class_id')::uuid, (item->>'date')::date, (item->>'lesson_number')::numeric::smallint,
      (item->>'subject_id')::uuid, nullif(btrim(item->>'teacher'),''), nullif(btrim(item->>'room'),''))
    on conflict(class_id,date,lesson_number) do update set
      subject_id=excluded.subject_id, teacher=excluded.teacher, room=excluded.room
    where (schedule.subject_id,schedule.teacher,schedule.room) is distinct from (excluded.subject_id,excluded.teacher,excluded.room);
  end loop;
  return jsonb_array_length(p_lessons);
end;
$$;
revoke all on function public.import_schedule(jsonb) from public, anon;
grant execute on function public.import_schedule(jsonb) to authenticated;
commit;
