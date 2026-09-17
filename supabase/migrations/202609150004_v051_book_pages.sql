begin;
create table if not exists public.book_extractions(
 book_variant_id uuid primary key references public.book_variants(id) on delete restrict,
 content_revision uuid not null, job_id uuid not null default gen_random_uuid(),
 status text not null check(status in('extracting','ready','failed')),
 page_count integer check(page_count between 1 and 1000), file_hash text,
 started_at timestamptz not null default now(), finished_at timestamptz
);
create table if not exists public.book_pages(
 id uuid primary key default gen_random_uuid(),
 book_variant_id uuid not null references public.book_variants(id) on delete restrict,
 content_revision uuid not null, page_number integer not null check(page_number between 1 and 1000),
 text text not null check(length(text)<=100000),
 extraction_status text not null check(extraction_status in('ready','empty')),
 text_hash text not null check(text_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(), unique(book_variant_id,content_revision,page_number)
);
alter table public.book_pages enable row level security;
alter table public.book_extractions enable row level security;
revoke all on public.book_pages,public.book_extractions from public,anon,authenticated;
grant select on public.book_pages,public.book_extractions to authenticated;
drop policy if exists "Admins inspect extraction" on public.book_extractions;
create policy "Admins inspect extraction" on public.book_extractions for select to authenticated using(public.is_admin());
drop policy if exists "Readers inspect published extraction" on public.book_extractions;
create policy "Readers inspect published extraction" on public.book_extractions for select to authenticated using(
 exists(select 1 from public.book_variants v join public.books b on b.id=v.book_id
 where v.id=book_variant_id and v.content_revision=book_extractions.content_revision and v.publication_status='published' and b.publication_status='published'));
drop policy if exists "Admins inspect pages" on public.book_pages;
create policy "Admins inspect pages" on public.book_pages for select to authenticated using(public.is_admin());
drop policy if exists "Readers see current published pages" on public.book_pages;
create policy "Readers see current published pages" on public.book_pages for select to authenticated using(
 exists(select 1 from public.book_variants v join public.books b on b.id=v.book_id join public.book_extractions e on e.book_variant_id=v.id
 where v.id=book_pages.book_variant_id and v.content_revision=book_pages.content_revision and e.content_revision=v.content_revision and e.status='ready'
 and v.publication_status='published' and b.publication_status='published'));
-- Storage API inserts/overwrites/deletes invalidate extracted text, even outside the editor.
-- No Storage permissions are broadened; only derived edition metadata changes.
create or replace function public.invalidate_pdf_text() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and new.updated_at is not distinct from old.updated_at and new.name=old.name and new.bucket_id=old.bucket_id then return null;end if;
 if TG_OP<>'INSERT' and old.bucket_id='book-files' then
  update public.book_variants set content_revision=gen_random_uuid() where storage_path=old.name;
 end if;
 if TG_OP<>'DELETE' and new.bucket_id='book-files' then
  update public.book_variants set content_revision=gen_random_uuid() where storage_path=new.name;
 end if;
 return null;
end;$$;
revoke all on function public.invalidate_pdf_text() from public,anon,authenticated;
drop trigger if exists nis_invalidate_pdf_text on storage.objects;
create trigger nis_invalidate_pdf_text after insert or update or delete on storage.objects for each row execute function public.invalidate_pdf_text();

create or replace function public.begin_book_extraction(p_variant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.book_variants; e public.book_extractions;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 select * into v from public.book_variants where id=p_variant for update;
 if not found then raise exception 'Edition unavailable';end if;
 select * into e from public.book_extractions where book_variant_id=p_variant for update;
 if e.content_revision=v.content_revision and e.status='ready' then return jsonb_build_object('ready',true);end if;
 if e.content_revision=v.content_revision and e.status='extracting' and e.started_at>now()-interval '15 minutes' then raise exception 'Extraction in progress';end if;
 insert into public.book_extractions(book_variant_id,content_revision,status) values(p_variant,v.content_revision,'extracting')
 on conflict(book_variant_id) do update set content_revision=v.content_revision,job_id=gen_random_uuid(),status='extracting',page_count=null,file_hash=null,started_at=now(),finished_at=null returning * into e;
 -- Derived text only: remove an incomplete attempt, never the original PDF or reading records.
 delete from public.book_pages where book_variant_id=p_variant;
 return jsonb_build_object('ready',false,'job',e.job_id,'revision',v.content_revision,'path',v.storage_path);
end;$$;
create or replace function public.put_book_pages(p_variant uuid,p_revision uuid,p_job uuid,p_pages jsonb) returns void language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 perform 1 from public.book_variants where id=p_variant and content_revision=p_revision for update;
 if not found then raise exception 'Source changed';end if;
 perform 1 from public.book_extractions where book_variant_id=p_variant and content_revision=p_revision and job_id=p_job and status='extracting' for update;
 if not found then raise exception 'Extraction unavailable';end if;
 if jsonb_typeof(p_pages)<>'array' or jsonb_array_length(p_pages) not between 1 and 5 or octet_length(p_pages::text)>2500000 then raise exception 'Invalid batch';end if;
 for item in select value from jsonb_array_elements(p_pages) loop
  if jsonb_typeof(item->'text')<>'string' then raise exception 'Invalid text';end if;
  insert into public.book_pages(book_variant_id,content_revision,page_number,text,extraction_status,text_hash)
  values(p_variant,p_revision,(item->>'page')::integer,item->>'text',case when btrim(item->>'text')='' then 'empty' else 'ready' end,encode(sha256(convert_to(item->>'text','UTF8')),'hex'))
  on conflict(book_variant_id,content_revision,page_number) do update set text=excluded.text,extraction_status=excluded.extraction_status,text_hash=excluded.text_hash;
 end loop;
 if (select coalesce(sum(length(text)),0)>10000000 from public.book_pages where book_variant_id=p_variant) then raise exception 'Text limit';end if;
end;$$;
create or replace function public.finish_book_extraction(p_variant uuid,p_revision uuid,p_job uuid,p_count integer,p_hash text,p_failed boolean default false) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 perform 1 from public.book_variants where id=p_variant and content_revision=p_revision for update;
 if not found then raise exception 'Source changed';end if;
 perform 1 from public.book_extractions where book_variant_id=p_variant and content_revision=p_revision and job_id=p_job and status='extracting' for update;
 if not found then raise exception 'Extraction unavailable';end if;
 if not p_failed and (p_hash!~'^[0-9a-f]{64}$' or p_hash is null or p_count is null or p_count not between 1 and 1000 or
  (select count(*)<>p_count or min(page_number)<>1 or max(page_number)<>p_count from public.book_pages where book_variant_id=p_variant and content_revision=p_revision)) then raise exception 'Incomplete text';end if;
 update public.book_extractions set status=case when p_failed then 'failed' else 'ready' end,
 page_count=case when p_failed then null else p_count end,file_hash=p_hash,finished_at=now() where book_variant_id=p_variant;
 if not p_failed then update public.book_variants set page_count=p_count where id=p_variant;end if;
end;$$;
revoke all on function public.begin_book_extraction(uuid),public.put_book_pages(uuid,uuid,uuid,jsonb),public.finish_book_extraction(uuid,uuid,uuid,integer,text,boolean) from public,anon;
grant execute on function public.begin_book_extraction(uuid),public.put_book_pages(uuid,uuid,uuid,jsonb),public.finish_book_extraction(uuid,uuid,uuid,integer,text,boolean) to authenticated;
commit;
