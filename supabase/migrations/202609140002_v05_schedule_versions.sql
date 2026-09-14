-- Immutable snapshots; all authenticated timetable mutations go through audited RPCs.
begin;
create table public.schedule_import_batches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default clock_timestamp(),
  created_by uuid references public.profiles(id) on delete set null,
  source_type text not null check (source_type in ('baseline','csv_tsv','delete','restore')),
  row_count integer not null check (row_count between 0 and 10000),
  note text not null default '' check (length(note)<=500),
  status text not null check (status in ('active','superseded')),
  previous_id uuid references public.schedule_import_batches(id) on delete restrict,
  restored_from uuid references public.schedule_import_batches(id) on delete restrict,
  snapshot jsonb not null check (jsonb_typeof(snapshot)='array' and jsonb_array_length(snapshot)=row_count)
);
create unique index one_active_schedule on public.schedule_import_batches(status) where status='active';
alter table public.schedule_import_batches enable row level security;
revoke all on public.schedule_import_batches from public,anon,authenticated;
grant select on public.schedule_import_batches to authenticated;
create policy "Admins read timetable history" on public.schedule_import_batches for select to authenticated using (public.is_admin());

create function private.record_schedule_version(p_source text,p_note text,p_restored uuid default null)
returns uuid language plpgsql set search_path='' as $$
declare result uuid; previous uuid; payload jsonb;
begin
  select id into previous from public.schedule_import_batches where status='active' for update;
  select coalesce(jsonb_agg(to_jsonb(w) order by w.id),'[]'::jsonb) into payload from public.weekly_schedule w;
  update public.schedule_import_batches set status='superseded' where id=previous;
  insert into public.schedule_import_batches(created_by,source_type,row_count,note,status,previous_id,restored_from,snapshot)
  values(auth.uid(),p_source,jsonb_array_length(payload),p_note,'active',previous,p_restored,payload) returning id into result;
  return result;
end;
$$;
revoke all on function private.record_schedule_version(text,text,uuid) from public,anon,authenticated;
select private.record_schedule_version('baseline','Phase 4 timetable preserved at v0.5 migration');

-- Retain the tested Phase 4 validation/upsert implementation in an unexposed schema.
alter function public.import_weekly_schedule(jsonb) set schema private;
revoke all on function private.import_weekly_schedule(jsonb) from public,anon,authenticated;
revoke insert,update,delete on public.weekly_schedule from authenticated;
create function public.import_weekly_schedule(p_lessons jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare total integer;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(505,1);
  total := private.import_weekly_schedule(p_lessons);
  perform private.record_schedule_version('csv_tsv','Imported rows: '||total);
  return total;
end;
$$;
create function public.delete_weekly_lesson(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(505,1);
  delete from public.weekly_schedule where id=p_id;
  if not found then raise exception 'Lesson not found' using errcode='23514'; end if;
  perform private.record_schedule_version('delete','Deleted lesson: '||p_id);
end;
$$;
create function public.restore_schedule_version(p_id uuid,p_expected_active uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare payload jsonb; current_id uuid; result uuid;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(505,1);
  select id into current_id from public.schedule_import_batches where status='active' for update;
  if current_id is distinct from p_expected_active or current_id=p_id then
    raise exception 'Active version changed; compare again' using errcode='23514';
  end if;
  select snapshot into payload from public.schedule_import_batches where id=p_id;
  if payload is null then raise exception 'Version not found' using errcode='23514'; end if;
  -- The whole replacement and its new audit record commit or roll back together.
  delete from public.weekly_schedule;
  insert into public.weekly_schedule select * from jsonb_populate_recordset(null::public.weekly_schedule,payload);
  result := private.record_schedule_version('restore','Restored version: '||p_id,p_id);
  return result;
end;
$$;
revoke all on function public.import_weekly_schedule(jsonb),public.delete_weekly_lesson(uuid),public.restore_schedule_version(uuid,uuid) from public,anon;
grant execute on function public.import_weekly_schedule(jsonb),public.delete_weekly_lesson(uuid),public.restore_schedule_version(uuid,uuid) to authenticated;
commit;
