-- Phase 4: collection permission confirmed by the owner. Preserve historical evidence.
begin;
alter table public.books drop constraint publication_requires_approval;
drop trigger book_publication_evidence on public.books;
drop trigger protect_published_rights on public.book_rights;
comment on column public.books.license_status is 'Historical only since Phase 4; NOT an access or publication gate.';
comment on table public.book_rights is 'Historical per-book evidence retained for administrator audit; not required for publication.';
-- Retire the old RPC, without deleting historical rows or functions.
revoke execute on function public.save_book(jsonb,text,text) from public, anon, authenticated;
drop policy "Published approved books are readable" on public.books;
create policy "Published books are readable" on public.books for select to authenticated
using (publication_status = 'published');
drop index public.books_browse_idx;
create index books_browse_idx on public.books(publication_status,class_id,subject_id);
drop policy "Approved book files readable by authenticated users" on storage.objects;
create policy "Published book files readable by authenticated users" on storage.objects for select to authenticated
using (bucket_id='book-files' and exists (
  select 1 from public.books b where b.file_path=name and b.publication_status='published'
));
-- Admin-only file writes and private bucket settings remain unchanged.
drop policy "Save bookmark on readable book" on public.bookmarks;
create policy "Save bookmark on readable book" on public.bookmarks for insert to authenticated
with check (profile_id=(select auth.uid()) and exists (
  select 1 from public.books b where b.id=book_id and b.publication_status='published'
  and (b.page_count is null or page_number<=b.page_count)
));
drop policy "Insert own readable progress" on public.reading_progress;
create policy "Insert own readable progress" on public.reading_progress for insert to authenticated
with check (profile_id=(select auth.uid()) and exists (
  select 1 from public.books b where b.id=book_id and b.publication_status='published'
  and (b.page_count is null or page_number<=b.page_count)
));
drop policy "Update own readable progress" on public.reading_progress;
create policy "Update own readable progress" on public.reading_progress for update to authenticated
using (profile_id=(select auth.uid())) with check (
  profile_id=(select auth.uid()) and exists (
    select 1 from public.books b where b.id=book_id and b.publication_status='published'
    and (b.page_count is null or page_number<=b.page_count)
));
create function public.save_book(p_book jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare bid uuid := (p_book->>'id')::uuid;
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  insert into public.books(id,title,subject_id,class_id,author,publisher,publication_year,language,file_path,page_count,publication_status)
  values (bid,p_book->>'title',(p_book->>'subject_id')::uuid,nullif(p_book->>'class_id','')::uuid,
    nullif(p_book->>'author',''),nullif(p_book->>'publisher',''),nullif(p_book->>'publication_year','')::smallint,
    nullif(p_book->>'language',''),p_book->>'file_path',nullif(p_book->>'page_count','')::integer,
    (p_book->>'publication_status')::public.book_publication_status)
  on conflict(id) do update set title=excluded.title,subject_id=excluded.subject_id,class_id=excluded.class_id,
    author=excluded.author,publisher=excluded.publisher,publication_year=excluded.publication_year,language=excluded.language,
    file_path=excluded.file_path,page_count=excluded.page_count,publication_status=excluded.publication_status;
  return bid;
end;
$$;
revoke all on function public.save_book(jsonb) from public, anon;
grant execute on function public.save_book(jsonb) to authenticated;
commit;
