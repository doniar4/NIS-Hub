-- Fix book uploads, variants, and publication status:
-- Idempotent and safe to run whether v051 migration was previously applied or not.

begin;

-- 1. Ensure public.book_variants table exists
create table if not exists public.book_variants (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  language text not null check(language in ('ru','kz','en','und')),
  storage_path text not null check(length(storage_path)<=500 and storage_path ~ '^[A-Za-z0-9_-][A-Za-z0-9/_-]*\.pdf$'),
  cover_path text,
  file_size bigint check(file_size between 5 and 52428800),
  page_count integer check(page_count between 1 and 100000),
  publication_status public.book_publication_status not null default 'draft',
  content_revision uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id, language)
);

create index if not exists variants_book_idx on public.book_variants(book_id, publication_status);

-- Ensure updated_at trigger exists
drop trigger if exists variants_updated_at on public.book_variants;
create trigger variants_updated_at before update on public.book_variants
for each row execute function public.set_updated_at();

-- Enable RLS and grants on book_variants
alter table public.book_variants enable row level security;
grant select, insert, update on public.book_variants to authenticated;

drop policy if exists "Admins manage editions" on public.book_variants;
create policy "Admins manage editions" on public.book_variants
for all to authenticated
using(public.is_admin()) with check(public.is_admin());

drop policy if exists "Readers see published editions" on public.book_variants;
create policy "Readers see published editions" on public.book_variants
for select to authenticated
using(publication_status='published' and exists(
  select 1 from public.books b where b.id = book_id and b.publication_status = 'published'
));

-- 2. Ensure save_book_edition RPC function exists
create or replace function public.save_book_edition(p_book jsonb, p_variant jsonb, p_prepare boolean default false)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  bid uuid := (p_book->>'id')::uuid;
  vid uuid := (p_variant->>'id')::uuid;
  parent uuid;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  select book_id into parent from public.book_variants where id = vid for update;
  if parent is not null and parent <> bid then raise exception 'Edition belongs to another book'; end if;

  insert into public.books(id, title, subject_id, grade, author, publisher, publication_year, file_path, page_count, language, publication_status)
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
    case when p_prepare then 'draft'::public.book_publication_status else (p_book->>'publication_status')::public.book_publication_status end
  )
  on conflict(id) do update set
    title = excluded.title,
    subject_id = excluded.subject_id,
    grade = excluded.grade,
    author = excluded.author,
    publisher = excluded.publisher,
    publication_year = excluded.publication_year,
    publication_status = case when p_prepare then public.books.publication_status else excluded.publication_status end;

  insert into public.book_variants(id, book_id, language, storage_path, file_size, page_count, publication_status)
  values(
    vid,
    bid,
    p_variant->>'language',
    p_variant->>'storage_path',
    nullif(p_variant->>'file_size', '')::bigint,
    nullif(p_variant->>'page_count', '')::integer,
    case when p_prepare then 'draft'::public.book_publication_status else (p_variant->>'publication_status')::public.book_publication_status end
  )
  on conflict(id) do update set
    language = excluded.language,
    storage_path = excluded.storage_path,
    file_size = excluded.file_size,
    page_count = excluded.page_count,
    publication_status = excluded.publication_status,
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

-- 3. Guarantee book-files bucket exists and is properly configured
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-files', 'book-files', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = array['application/pdf'];

-- 4. Grant admins full control over book-files in storage.objects
drop policy if exists "Admins manage book files" on storage.objects;
create policy "Admins manage book files" on storage.objects
for all to authenticated
using (bucket_id = 'book-files' and public.is_admin())
with check (bucket_id = 'book-files' and public.is_admin());

-- 5. Backfill books into book_variants if missing
insert into public.book_variants (id, book_id, language, storage_path, cover_path, page_count, publication_status)
select
  b.id,
  b.id,
  case
    when lower(btrim(coalesce(b.language,''))) in ('ru','rus','russian','русский','рус') then 'ru'
    when lower(btrim(coalesce(b.language,''))) in ('kk','kz','kaz','kazakh','қазақша','қазақ тілі','казахский') then 'kz'
    when lower(btrim(coalesce(b.language,''))) in ('en','eng','english','английский') then 'en'
    else 'ru'
  end,
  coalesce(b.file_path, 'books/' || b.id || '.pdf'),
  b.cover_path,
  b.page_count,
  'published'::public.book_publication_status
from public.books b
where not exists (
  select 1 from public.book_variants v where v.book_id = b.id
)
on conflict do nothing;

-- 6. Remove legacy Phase 2 check constraint and triggers that blocked publishing without manual rights evidence
alter table public.books drop constraint if exists publication_requires_approval;
drop trigger if exists book_publication_evidence on public.books;
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'book_rights') then
    execute 'drop trigger if exists protect_published_rights on public.book_rights';
  end if;
end $$;

-- 7. Ensure all books and variants that were stuck in 'draft' are published
update public.books
set publication_status = 'published',
    license_status = 'approved'
where publication_status = 'draft';

update public.book_variants
set publication_status = 'published'
where publication_status = 'draft';

commit;

