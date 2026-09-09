-- NIS Library v0.1 initial schema
-- Apply in a new Supabase project before connecting the production UI.
-- This file is an engineering starting point, not a substitute for legal review.

create type public.profile_role as enum ('student', 'admin');
create type public.book_publication_status as enum ('draft', 'published', 'archived');
create type public.book_license_status as enum ('pending_review', 'approved', 'restricted');

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  grade smallint,
  section text,
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  name_kz text,
  name_en text,
  short_name text,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  avatar_path text,
  class_id uuid references public.classes(id) on delete set null,
  bio text check (char_length(bio) <= 280),
  role public.profile_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  class_id uuid references public.classes(id) on delete set null,
  author text,
  publisher text,
  publication_year smallint check (publication_year between 1000 and 9999),
  language text,
  cover_path text,
  file_path text not null,
  license_status public.book_license_status not null default 'pending_review',
  publication_status public.book_publication_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  page_number integer check (page_number is null or page_number > 0),
  created_at timestamptz not null default now(),
  unique (profile_id, book_id, page_number)
);

create table public.schedule (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  date date not null,
  lesson_number smallint not null check (lesson_number > 0),
  subject_id uuid not null references public.subjects(id) on delete restrict,
  teacher text,
  room text,
  created_at timestamptz not null default now(),
  unique (class_id, date, lesson_number)
);

create table public.profile_top_subjects (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  position smallint not null check (position between 1 and 4),
  primary key (profile_id, position),
  unique (profile_id, subject_id)
);

create index books_browse_idx on public.books (publication_status, license_status, class_id, subject_id);
create index schedule_by_class_date_idx on public.schedule (class_id, date, lesson_number);
create index bookmarks_by_profile_idx on public.bookmarks (profile_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

create trigger books_set_updated_at before update on public.books
for each row execute function public.set_updated_at();

-- The operator must promote the first administrator through the dashboard or a
-- controlled server-side process. Never expose role assignment in the browser.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.bookmarks enable row level security;
alter table public.schedule enable row level security;
alter table public.profile_top_subjects enable row level security;

create policy "Classes are readable to signed-in users" on public.classes
for select to authenticated using (true);
create policy "Subjects are readable to signed-in users" on public.subjects
for select to authenticated using (true);
create policy "Admins manage classes" on public.classes
for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage subjects" on public.subjects
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users read their own profile" on public.profiles
for select to authenticated using (id = auth.uid());
create policy "Admins read profiles" on public.profiles
for select to authenticated using (public.is_admin());
create policy "Users update their own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "Published approved books are readable" on public.books
for select to authenticated using (
  publication_status = 'published' and license_status = 'approved'
);
create policy "Admins manage books" on public.books
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users manage their own bookmarks" on public.bookmarks
for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "Signed-in users read schedule" on public.schedule
for select to authenticated using (true);
create policy "Admins manage schedule" on public.schedule
for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "Users manage their Top 4" on public.profile_top_subjects
for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Column-level grants keep students from changing their role even though they
-- may update the rest of their own profile.
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path, class_id, bio) on public.profiles to authenticated;

-- Private buckets. Book files intentionally receive no user read policy;
-- issue time-limited URLs only from a server-side authorization check.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false), ('book-files', 'book-files', false)
on conflict (id) do nothing;

create policy "Users read their own avatar" on storage.objects
for select to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "Users upload their own avatar" on storage.objects
for insert to authenticated with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "Users update their own avatar" on storage.objects
for update to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "Users delete their own avatar" on storage.objects
for delete to authenticated using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text)
);
create policy "Admins manage book files" on storage.objects
for all to authenticated using (bucket_id = 'book-files' and public.is_admin())
with check (bucket_id = 'book-files' and public.is_admin());
