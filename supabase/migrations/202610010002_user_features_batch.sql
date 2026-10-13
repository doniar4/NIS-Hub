-- Migration: 202610010002_user_features_batch.sql
-- Description:
-- 1. Book covers: support cover_path in save_book_edition and ensure storage bucket book-covers with RLS.
-- 2. Personal tasks: add subtasks jsonb column and update save_personal_task RPC.
-- 3. PDF Highlights: create book_highlights table for storing marker highlights.
-- 4. User Tracker: create user_activity_logs table and activity ping function for admin dashboard.

-- 1. Book Covers: ensure bucket and RLS
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Admins manage book covers" on storage.objects;
create policy "Admins manage book covers" on storage.objects
  for all to authenticated
  using (bucket_id = 'book-covers' and public.is_admin())
  with check (bucket_id = 'book-covers' and public.is_admin());

drop policy if exists "Authenticated read book covers" on storage.objects;
create policy "Authenticated read book covers" on storage.objects
  for select to authenticated
  using (bucket_id = 'book-covers');

-- Update save_book_edition to persist cover_path
create or replace function public.save_book_edition(
  p_book jsonb,
  p_variant jsonb,
  p_prepare boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  bid uuid := (p_book->>'id')::uuid;
  vid uuid := (p_variant->>'id')::uuid;
  parent uuid;
  v_cover text := nullif(coalesce(p_variant->>'cover_path', p_book->>'cover_path', ''), '');
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select book_id into parent from public.book_variants where id = vid for update;
  if parent is not null and parent <> bid then raise exception 'Edition belongs to another book'; end if;

  insert into public.books(id, title, subject_id, grade, author, publisher, publication_year, file_path, page_count, language, publication_status, cover_path)
  values(
    bid,
    p_book->>'title',
    (p_book->>'subject_id')::uuid,
    (p_book->>'grade')::smallint,
    nullif(p_book->>'author', ''),
    nullif(p_book->>'publisher', ''),
    nullif(p_book->>'publication_year', '')::smallint,
    p_variant->>'storage_path',
    nullif(p_variant->>'page_count', '')::integer,
    p_variant->>'language',
    case when p_prepare then 'draft'::public.book_publication_status else (p_book->>'publication_status')::public.book_publication_status end,
    v_cover
  )
  on conflict(id) do update set
    title = excluded.title,
    subject_id = excluded.subject_id,
    grade = excluded.grade,
    author = excluded.author,
    publisher = excluded.publisher,
    publication_year = excluded.publication_year,
    publication_status = case when p_prepare then public.books.publication_status else excluded.publication_status end,
    cover_path = coalesce(excluded.cover_path, public.books.cover_path);

  insert into public.book_variants(id, book_id, language, storage_path, file_size, page_count, publication_status, cover_path)
  values(
    vid,
    bid,
    p_variant->>'language',
    p_variant->>'storage_path',
    nullif(p_variant->>'file_size', '')::bigint,
    nullif(p_variant->>'page_count', '')::integer,
    case when p_prepare then 'draft'::public.book_publication_status else (p_variant->>'publication_status')::public.book_publication_status end,
    v_cover
  )
  on conflict(id) do update set
    language = excluded.language,
    storage_path = excluded.storage_path,
    file_size = excluded.file_size,
    page_count = excluded.page_count,
    publication_status = excluded.publication_status,
    cover_path = coalesce(excluded.cover_path, public.book_variants.cover_path),
    content_revision = case
      when p_prepare or public.book_variants.storage_path <> excluded.storage_path
      then gen_random_uuid()
      else public.book_variants.content_revision
    end;

  return vid;
end;
$$;

revoke all on function public.save_book_edition(jsonb, jsonb, boolean) from public, anon;
grant execute on function public.save_book_edition(jsonb, jsonb, boolean) to authenticated;

-- 2. Personal Tasks: Add subtasks
alter table public.personal_tasks
  add column if not exists subtasks jsonb not null default '[]'::jsonb;

create or replace function public.save_personal_task(
  p_id uuid,
  p_title text,
  p_notes text,
  p_priority text,
  p_subject uuid,
  p_due timestamptz,
  p_remind timestamptz,
  p_subtasks jsonb
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
    insert into public.personal_tasks(owner_id,subject_id,title,notes,priority,due_at,remind_at,subtasks)
    values(uid,p_subject,btrim(p_title),btrim(p_notes),p_priority,p_due,p_remind,coalesce(p_subtasks,'[]'::jsonb))
    returning id into result;
  else
    update public.personal_tasks set
      subject_id=p_subject,title=btrim(p_title),notes=btrim(p_notes),priority=p_priority,
      due_at=p_due,remind_at=p_remind,
      subtasks=coalesce(p_subtasks,personal_tasks.subtasks),
      reminder_read_at=case when remind_at is distinct from p_remind then null else reminder_read_at end,
      updated_at=clock_timestamp()
    where id=p_id and owner_id=uid and status<>'archived'
    returning id into result;
    if result is null then raise exception 'unavailable'; end if;
  end if;
  return result;
end $$;

-- Overload backward-compatibility for 7-arg calls
create or replace function public.save_personal_task(
  p_id uuid,
  p_title text,
  p_notes text,
  p_priority text,
  p_subject uuid,
  p_due timestamptz,
  p_remind timestamptz
) returns uuid
language plpgsql security definer set search_path='' as $$
begin
  return public.save_personal_task(p_id, p_title, p_notes, p_priority, p_subject, p_due, p_remind, '[]'::jsonb);
end $$;

grant execute on function public.save_personal_task(uuid,text,text,text,uuid,timestamptz,timestamptz,jsonb) to authenticated;
grant execute on function public.save_personal_task(uuid,text,text,text,uuid,timestamptz,timestamptz) to authenticated;

-- Function to quickly toggle a subtask
create or replace function public.toggle_task_subtask(
  p_task_id uuid,
  p_subtask_id text,
  p_completed boolean
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  v_subtasks jsonb;
  new_subtasks jsonb := '[]'::jsonb;
  elem jsonb;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select subtasks into v_subtasks from public.personal_tasks where id = p_task_id and owner_id = uid;
  if v_subtasks is null then raise exception 'unavailable'; end if;

  for elem in select * from jsonb_array_elements(v_subtasks) loop
    if elem->>'id' = p_subtask_id then
      new_subtasks := new_subtasks || jsonb_build_object(
        'id', elem->>'id',
        'title', elem->>'title',
        'completed', p_completed
      );
    else
      new_subtasks := new_subtasks || elem;
    end if;
  end loop;

  update public.personal_tasks
  set subtasks = new_subtasks, updated_at = clock_timestamp()
  where id = p_task_id and owner_id = uid;

  return new_subtasks;
end $$;

grant execute on function public.toggle_task_subtask(uuid,text,boolean) to authenticated;

-- 3. PDF Highlights
create table if not exists public.book_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_variant_id uuid not null references public.book_variants(id) on delete cascade,
  page_number integer not null,
  color text not null check (color in ('yellow', 'green', 'blue', 'black')),
  rects jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_highlights_user_variant
  on public.book_highlights(user_id, book_variant_id, page_number);

alter table public.book_highlights enable row level security;

drop policy if exists "Users manage own highlights" on public.book_highlights;
create policy "Users manage own highlights" on public.book_highlights
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 4. User Tracker: Activity logs
create table if not exists public.user_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  path text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_created_at
  on public.user_activity_logs(created_at desc);

create index if not exists idx_activity_user_id
  on public.user_activity_logs(user_id);

alter table public.user_activity_logs enable row level security;

drop policy if exists "Admins view activity logs" on public.user_activity_logs;
create policy "Admins view activity logs" on public.user_activity_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists "Users record activity logs" on public.user_activity_logs;
create policy "Users record activity logs" on public.user_activity_logs
  for insert to authenticated
  with check (auth.uid() is not null);

-- RPC for logging visits safely
create or replace function public.log_user_activity(p_path text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  insert into public.user_activity_logs(user_id, path, user_agent)
  values(uid, left(p_path, 255), left(p_user_agent, 255));
end;
$$;

grant execute on function public.log_user_activity(text, text) to authenticated;
