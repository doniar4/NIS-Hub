-- Searchable catalog metadata for the client-side Fuse.js index.
begin;

alter table public.books
  add column if not exists description text check (char_length(description) <= 1000),
  add column if not exists tags text[] not null default '{}',
  add column if not exists quarter smallint check (quarter between 1 and 4);

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
  v_tags text[] := array(select jsonb_array_elements_text(coalesce(p_book->'tags', '[]'::jsonb)));
begin
  if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
  if cardinality(v_tags) > 20 or exists(select 1 from unnest(v_tags) tag where char_length(tag) > 50) then
    raise exception 'Invalid tags';
  end if;
  select book_id into parent from public.book_variants where id = vid for update;
  if parent is not null and parent <> bid then raise exception 'Edition belongs to another book'; end if;

  insert into public.books(id,title,description,tags,quarter,subject_id,grade,author,publisher,publication_year,file_path,page_count,language,publication_status,cover_path)
  values(
    bid,p_book->>'title',nullif(p_book->>'description',''),v_tags,nullif(p_book->>'quarter','')::smallint,
    (p_book->>'subject_id')::uuid,(p_book->>'grade')::smallint,nullif(p_book->>'author',''),nullif(p_book->>'publisher',''),
    nullif(p_book->>'publication_year','')::smallint,p_variant->>'storage_path',nullif(p_variant->>'page_count','')::integer,
    p_variant->>'language',case when p_prepare then 'draft'::public.book_publication_status else (p_book->>'publication_status')::public.book_publication_status end,v_cover
  )
  on conflict(id) do update set
    title=excluded.title,description=excluded.description,tags=excluded.tags,quarter=excluded.quarter,subject_id=excluded.subject_id,grade=excluded.grade,
    author=excluded.author,publisher=excluded.publisher,publication_year=excluded.publication_year,
    publication_status=case when p_prepare then public.books.publication_status else excluded.publication_status end,
    cover_path=coalesce(excluded.cover_path,public.books.cover_path);

  insert into public.book_variants(id,book_id,language,storage_path,file_size,page_count,publication_status,cover_path)
  values(
    vid,bid,p_variant->>'language',p_variant->>'storage_path',nullif(p_variant->>'file_size','')::bigint,nullif(p_variant->>'page_count','')::integer,
    case when p_prepare then 'draft'::public.book_publication_status else (p_variant->>'publication_status')::public.book_publication_status end,v_cover
  )
  on conflict(id) do update set
    language=excluded.language,storage_path=excluded.storage_path,file_size=excluded.file_size,page_count=excluded.page_count,
    publication_status=excluded.publication_status,cover_path=coalesce(excluded.cover_path,public.book_variants.cover_path),
    content_revision=case when p_prepare or public.book_variants.storage_path<>excluded.storage_path then gen_random_uuid() else public.book_variants.content_revision end;

  return vid;
end;
$$;

revoke all on function public.save_book_edition(jsonb,jsonb,boolean) from public,anon;
grant execute on function public.save_book_edition(jsonb,jsonb,boolean) to authenticated;

commit;
