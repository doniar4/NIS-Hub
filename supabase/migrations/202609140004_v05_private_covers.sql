-- Optional real covers only; book-files PDF restrictions remain unchanged.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('book-covers','book-covers',false,2097152,array['image/webp','image/png','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Admins manage private book covers" on storage.objects for all to authenticated
using(bucket_id='book-covers' and public.is_admin())
with check(bucket_id='book-covers' and public.is_admin() and name ~ '^books/[0-9a-f-]{36}\.(webp|png|jpg|jpeg)$');
create policy "Signed in readers see published book covers" on storage.objects for select to authenticated
using(bucket_id='book-covers' and exists(select 1 from public.books b where b.cover_path=name and b.publication_status='published'));
commit;
