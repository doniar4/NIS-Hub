-- Apply AFTER the unchanged supabase/schema.sql. Transactional and additive.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, role) values (new.id, 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_profile() from public;
create trigger auth_user_profile after insert on auth.users
for each row execute function private.create_profile();
insert into public.profiles(id, role)
select id, 'student' from auth.users on conflict (id) do nothing;

-- Do not allow profile creation with a chosen role or ID through the Data API.
drop policy if exists "Users create their own student profile" on public.profiles;
revoke insert, delete, update on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name, class_id, bio, avatar_path) on public.profiles to authenticated;
drop policy "Admins read profiles" on public.profiles;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Deleting reference data must not silently clear profiles or cascade lessons.
alter table public.profiles drop constraint profiles_class_id_fkey,
  add constraint profiles_class_id_fkey foreign key(class_id) references public.classes(id) on delete restrict;
alter table public.books drop constraint books_class_id_fkey,
  add constraint books_class_id_fkey foreign key(class_id) references public.classes(id) on delete restrict;
alter table public.schedule drop constraint schedule_class_id_fkey,
  add constraint schedule_class_id_fkey foreign key(class_id) references public.classes(id) on delete restrict;

alter table public.books add column page_count integer check (page_count between 1 and 100000);
alter table public.books add constraint book_title_length check (length(btrim(title)) between 1 and 200);
alter table public.books add constraint book_relative_pdf_path check (
  file_path ~ '^[a-zA-Z0-9/_-]+\.pdf$' and file_path !~ '^/'
);
-- Unapproved historical published records are not exposed even before migration.
-- Retain them as drafts so the publication constraint can be added safely.
update public.books set publication_status = 'draft'
where publication_status = 'published' and license_status <> 'approved';
alter table public.books add constraint publication_requires_approval
check (publication_status <> 'published' or license_status = 'approved');

create table public.book_rights (
  book_id uuid primary key references public.books(id) on delete cascade,
  source text not null check (length(btrim(source)) between 1 and 500),
  permission_note text not null check (length(btrim(permission_note)) between 1 and 2000)
);
alter table public.book_rights enable row level security;
revoke update on public.book_rights from authenticated;
grant select, insert, delete on public.book_rights to authenticated;
grant update(source, permission_note) on public.book_rights to authenticated;
create policy "Only admins manage rights evidence" on public.book_rights
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Existing published books need explicit evidence before being published again.
update public.books set publication_status = 'draft' where publication_status = 'published';
create or replace function private.check_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.publication_status = 'published' and not exists (
    select 1 from public.book_rights where book_id = new.id
  ) then
    raise exception 'Rights evidence is required before publication' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.check_publication() from public;
create constraint trigger book_publication_evidence after insert or update on public.books
deferrable initially deferred for each row execute function private.check_publication();

-- Rights evidence cannot be removed while the linked material is published.
create or replace function private.protect_rights()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.books where id = old.book_id and publication_status = 'published') then
    raise exception 'Unpublish the book before removing its evidence' using errcode = '23514';
  end if;
  return old;
end;
$$;
create trigger protect_published_rights before delete on public.book_rights
for each row execute function private.protect_rights();
revoke all on function private.protect_rights() from public;

-- Book-only bookmarks from v0.1 map to the first page; no data is discarded.
-- Abort for duplicate legacy rows rather than silently deleting user data.
do $$ begin
  if exists(select 1 from public.bookmarks group by profile_id, book_id, coalesce(page_number, 1) having count(*) > 1) then
    raise exception 'Resolve duplicate legacy bookmarks before applying Phase 2';
  end if;
end $$;
update public.bookmarks set page_number = 1 where page_number is null;
alter table public.bookmarks alter column page_number set not null;
alter table public.bookmarks add constraint bookmark_page_limit check (page_number <= 100000);
drop policy "Users manage their own bookmarks" on public.bookmarks;
create policy "Read own bookmarks" on public.bookmarks for select to authenticated using (profile_id = (select auth.uid()));
create policy "Delete own bookmarks" on public.bookmarks for delete to authenticated using (profile_id = (select auth.uid()));
create policy "Save bookmark on readable book" on public.bookmarks for insert to authenticated
with check (profile_id = (select auth.uid()) and exists (
  select 1 from public.books b where b.id = book_id and b.publication_status = 'published' and b.license_status = 'approved'
  and (b.page_count is null or page_number <= b.page_count)
));

create table public.reading_progress (
  profile_id uuid references public.profiles(id) on delete cascade,
  book_id uuid references public.books(id) on delete cascade,
  page_number integer not null check (page_number between 1 and 100000),
  updated_at timestamptz not null default now(),
  primary key(profile_id, book_id)
);
alter table public.reading_progress enable row level security;
grant select, insert, update, delete on public.reading_progress to authenticated;
create policy "Read own progress" on public.reading_progress for select to authenticated using (profile_id = (select auth.uid()));
create policy "Delete own progress" on public.reading_progress for delete to authenticated using (profile_id = (select auth.uid()));
create policy "Insert own readable progress" on public.reading_progress for insert to authenticated with check (
  profile_id = (select auth.uid()) and exists (
    select 1 from public.books b where b.id = book_id and b.publication_status = 'published' and b.license_status = 'approved'
    and (b.page_count is null or page_number <= b.page_count)
  )
);
create policy "Update own readable progress" on public.reading_progress for update to authenticated
using (profile_id = (select auth.uid())) with check (
  profile_id = (select auth.uid()) and exists (
    select 1 from public.books b where b.id = book_id and b.publication_status = 'published' and b.license_status = 'approved'
    and (b.page_count is null or page_number <= b.page_count)
  )
);
create trigger progress_updated_at before update on public.reading_progress for each row execute function public.set_updated_at();

-- Atomic profile + Top 4 update, serialized per user, executed with caller's RLS.
create or replace function public.save_profile(p_name text, p_class uuid, p_subjects uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 60 then raise exception 'Invalid name' using errcode = '23514'; end if;
  if p_subjects is null or cardinality(p_subjects) > 4 or array_position(p_subjects, null) is not null
    or cardinality(p_subjects) <> (select count(distinct s) from unnest(p_subjects) s)
  then raise exception 'Select up to four unique subjects' using errcode = '23514'; end if;
  perform 1 from public.profiles where id = uid for update;
  if not found then raise exception 'Profile missing' using errcode = '23503'; end if;
  update public.profiles set display_name = btrim(p_name), class_id = p_class where id = uid;
  delete from public.profile_top_subjects where profile_id = uid;
  insert into public.profile_top_subjects(profile_id, subject_id, position)
    select uid, subject, ordinality from unnest(p_subjects) with ordinality as s(subject, ordinality);
end;
$$;
revoke all on function public.save_profile(text, uuid, uuid[]) from public, anon;
grant execute on function public.save_profile(text, uuid, uuid[]) to authenticated;

-- Single transactional admin write for metadata + evidence. The invoker still
-- passes all grants, constraints and RLS; no elevated key is needed by the app.
create or replace function public.save_book(p_book jsonb, p_source text, p_note text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare bid uuid := coalesce(nullif(p_book->>'id','')::uuid, gen_random_uuid());
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode = '42501'; end if;
  insert into public.books(id,title,subject_id,class_id,author,publisher,publication_year,language,file_path,page_count,license_status,publication_status)
  values (bid,p_book->>'title',(p_book->>'subject_id')::uuid,nullif(p_book->>'class_id','')::uuid,
    nullif(p_book->>'author',''),nullif(p_book->>'publisher',''),nullif(p_book->>'publication_year','')::smallint,
    nullif(p_book->>'language',''),p_book->>'file_path',nullif(p_book->>'page_count','')::integer,
    (p_book->>'license_status')::public.book_license_status,(p_book->>'publication_status')::public.book_publication_status)
  on conflict(id) do update set title=excluded.title,subject_id=excluded.subject_id,class_id=excluded.class_id,
    author=excluded.author,publisher=excluded.publisher,publication_year=excluded.publication_year,language=excluded.language,
    file_path=excluded.file_path,page_count=excluded.page_count,license_status=excluded.license_status,publication_status=excluded.publication_status;
  insert into public.book_rights(book_id,source,permission_note) values(bid,p_source,p_note)
    on conflict(book_id) do update set source=excluded.source,permission_note=excluded.permission_note;
  return bid;
end;
$$;
revoke all on function public.save_book(jsonb,text,text) from public, anon;
grant execute on function public.save_book(jsonb,text,text) to authenticated;

-- Explicit grants, no dependency on a particular project's default privileges.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.classes, public.subjects, public.books, public.schedule, public.profile_top_subjects to authenticated;
grant select, insert, delete on public.bookmarks to authenticated;
revoke update on public.bookmarks from authenticated;
revoke all on public.classes, public.subjects, public.profiles, public.books, public.schedule, public.profile_top_subjects,
  public.bookmarks, public.reading_progress, public.book_rights from anon;

-- Private signed URLs are issued with the user's session, after a server check.
update storage.buckets set public=false, file_size_limit=52428800, allowed_mime_types=array['application/pdf'] where id='book-files';
update storage.buckets set public=false, file_size_limit=2097152, allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='avatars';
create policy "Approved book files readable by authenticated users" on storage.objects
for select to authenticated using (bucket_id='book-files' and exists (
  select 1 from public.books b where b.file_path=name and b.license_status='approved' and b.publication_status='published'
));
drop policy "Users update their own avatar" on storage.objects;
create policy "Users update their own avatar" on storage.objects for update to authenticated
using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid()::text))
with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid()::text));

commit;
