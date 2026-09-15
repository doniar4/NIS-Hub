begin;
create table public.book_variants (
 id uuid primary key default gen_random_uuid(),
 book_id uuid not null references public.books(id) on delete restrict,
 language text not null check(language in ('ru','kz','en','und')),
 storage_path text not null check(length(storage_path)<=500 and storage_path ~ '^[A-Za-z0-9_-][A-Za-z0-9/_-]*\.pdf$'),
 cover_path text,
 file_size bigint check(file_size between 5 and 52428800),
 page_count integer check(page_count between 1 and 100000),
 publication_status public.book_publication_status not null default 'draft',
 content_revision uuid not null default gen_random_uuid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(book_id,language)
);
create index variants_book_idx on public.book_variants(book_id,publication_status);
create trigger variants_updated_at before update on public.book_variants for each row execute function public.set_updated_at();
-- The default edition ID is the original book ID: old URLs and reading records remain resolvable.
insert into public.book_variants(id,book_id,language,storage_path,cover_path,page_count,publication_status,created_at,updated_at)
select id,id,case
 when lower(btrim(language)) in ('ru','rus','russian','русский','рус') then 'ru'
 when lower(btrim(language)) in ('kk','kz','kaz','kazakh','қазақша','қазақ тілі','казахский') then 'kz'
 when lower(btrim(language)) in ('en','eng','english','английский') then 'en' else 'und' end,
 file_path,cover_path,page_count,publication_status,created_at,updated_at from public.books;
alter table public.book_variants enable row level security;
revoke all on public.book_variants from public,anon,authenticated;
grant select,insert,update on public.book_variants to authenticated;
create policy "Admins manage editions" on public.book_variants for all to authenticated
using(public.is_admin()) with check(public.is_admin());
create policy "Readers see published editions" on public.book_variants for select to authenticated
using(publication_status='published' and exists(select 1 from public.books b where b.id=book_id and b.publication_status='published'));
-- Same publication rule, now checked against the selected edition rather than a stale legacy path.
alter policy "Published book files readable by authenticated users" on storage.objects
using(bucket_id='book-files' and exists(select 1 from public.book_variants v join public.books b on b.id=v.book_id
 where v.storage_path=name and v.publication_status='published' and b.publication_status='published'));
alter policy "Signed in readers see published book covers" on storage.objects
using(bucket_id='book-covers' and exists(select 1 from public.book_variants v join public.books b on b.id=v.book_id
 where v.cover_path=name and v.publication_status='published' and b.publication_status='published'));

create table public.variant_bookmarks (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references public.profiles(id) on delete cascade,
 book_variant_id uuid not null references public.book_variants(id) on delete restrict,
 page_number integer not null check(page_number between 1 and 100000), created_at timestamptz not null default now(),
 unique(profile_id,book_variant_id,page_number)
);
create table public.variant_reading_progress (
 profile_id uuid not null references public.profiles(id) on delete cascade,
 book_variant_id uuid not null references public.book_variants(id) on delete restrict,
 page_number integer not null check(page_number between 1 and 100000), updated_at timestamptz not null default now(),
 primary key(profile_id,book_variant_id)
);
insert into public.variant_bookmarks(id,profile_id,book_variant_id,page_number,created_at)
select id,profile_id,book_id,page_number,created_at from public.bookmarks;
insert into public.variant_reading_progress(profile_id,book_variant_id,page_number,updated_at)
select profile_id,book_id,page_number,updated_at from public.reading_progress;
create trigger variant_progress_updated before update on public.variant_reading_progress for each row execute function public.set_updated_at();
alter table public.variant_bookmarks enable row level security;
alter table public.variant_reading_progress enable row level security;
revoke all on public.variant_bookmarks,public.variant_reading_progress from public,anon,authenticated;
grant select,insert,delete on public.variant_bookmarks to authenticated;
grant select,insert,update,delete on public.variant_reading_progress to authenticated;
create policy "Read own edition bookmarks" on public.variant_bookmarks for select to authenticated using(profile_id=auth.uid());
create policy "Delete own edition bookmarks" on public.variant_bookmarks for delete to authenticated using(profile_id=auth.uid());
create policy "Bookmark published edition" on public.variant_bookmarks for insert to authenticated with check(
 profile_id=auth.uid() and exists(select 1 from public.book_variants v join public.books b on b.id=v.book_id where v.id=book_variant_id
 and v.publication_status='published' and b.publication_status='published' and (v.page_count is null or page_number<=v.page_count)));
create policy "Read own edition progress" on public.variant_reading_progress for select to authenticated using(profile_id=auth.uid());
create policy "Delete own edition progress" on public.variant_reading_progress for delete to authenticated using(profile_id=auth.uid());
create policy "Insert own edition progress" on public.variant_reading_progress for insert to authenticated with check(
 profile_id=auth.uid() and exists(select 1 from public.book_variants v join public.books b on b.id=v.book_id where v.id=book_variant_id
 and v.publication_status='published' and b.publication_status='published' and (v.page_count is null or page_number<=v.page_count)));
create policy "Update own edition progress" on public.variant_reading_progress for update to authenticated using(profile_id=auth.uid()) with check(
 profile_id=auth.uid() and exists(select 1 from public.book_variants v join public.books b on b.id=v.book_id where v.id=book_variant_id
 and v.publication_status='published' and b.publication_status='published' and (v.page_count is null or page_number<=v.page_count)));

create function public.save_book_edition(p_book jsonb,p_variant jsonb,p_prepare boolean default false)
returns uuid language plpgsql security invoker set search_path='' as $$
declare bid uuid := (p_book->>'id')::uuid; vid uuid := (p_variant->>'id')::uuid; parent uuid;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 select book_id into parent from public.book_variants where id=vid for update;
 if parent is not null and parent<>bid then raise exception 'Edition belongs to another book'; end if;
 insert into public.books(id,title,subject_id,grade,author,publisher,publication_year,file_path,page_count,language,publication_status)
 values(bid,p_book->>'title',(p_book->>'subject_id')::uuid,(p_book->>'grade')::smallint,
 nullif(p_book->>'author',''),nullif(p_book->>'publisher',''),nullif(p_book->>'publication_year','')::smallint,
 p_variant->>'storage_path',nullif(p_variant->>'page_count','')::integer,p_variant->>'language',
 case when p_prepare then 'draft'::public.book_publication_status else (p_book->>'publication_status')::public.book_publication_status end)
 on conflict(id) do update set title=excluded.title,subject_id=excluded.subject_id,grade=excluded.grade,
 author=excluded.author,publisher=excluded.publisher,publication_year=excluded.publication_year,
 publication_status=case when p_prepare then public.books.publication_status else excluded.publication_status end;
 insert into public.book_variants(id,book_id,language,storage_path,file_size,page_count,publication_status)
 values(vid,bid,p_variant->>'language',p_variant->>'storage_path',nullif(p_variant->>'file_size','')::bigint,
 nullif(p_variant->>'page_count','')::integer,
 case when p_prepare then 'draft'::public.book_publication_status else (p_variant->>'publication_status')::public.book_publication_status end)
 on conflict(id) do update set language=excluded.language,storage_path=excluded.storage_path,
 file_size=excluded.file_size,page_count=excluded.page_count,publication_status=excluded.publication_status,
 content_revision=case when p_prepare or public.book_variants.storage_path<>excluded.storage_path
 then gen_random_uuid() else public.book_variants.content_revision end;
 return vid;
end;
$$;
revoke all on function public.save_book_edition(jsonb,jsonb,boolean) from public,anon;
grant execute on function public.save_book_edition(jsonb,jsonb,boolean) to authenticated;
comment on table public.bookmarks is 'Legacy records preserved and copied to variant_bookmarks by v0.5.1. New app writes variant_bookmarks.';
comment on table public.reading_progress is 'Legacy records preserved and copied to variant_reading_progress by v0.5.1.';
commit;
