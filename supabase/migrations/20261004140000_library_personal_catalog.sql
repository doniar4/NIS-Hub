begin;
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
grant usage on schema extensions to authenticated;

create table if not exists public.library_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(user_id,book_id)
);
create table if not exists public.library_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(), unique(user_id,name), unique(id,user_id)
);
create table if not exists public.library_collection_books (
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(collection_id,book_id),
  foreign key(collection_id,user_id) references public.library_collections(id,user_id) on delete cascade
);
create table if not exists public.library_search_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  query text not null check(char_length(trim(query)) between 1 and 100),
  searched_at timestamptz not null default now(), primary key(user_id,query)
);
create table if not exists public.library_recent_books (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  opened_at timestamptz not null default now(), primary key(user_id,book_id)
);
do $$ declare t text; begin
  foreach t in array array['library_favorites','library_collections','library_collection_books','library_search_history','library_recent_books'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists own_rows on public.%I',t);
    execute format('create policy own_rows on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('revoke all on public.%I from anon',t);
  end loop;
end $$;
create index if not exists library_history_recent on public.library_search_history(user_id,searched_at desc);
create index if not exists library_recent_opened on public.library_recent_books(user_id,opened_at desc);

create or replace function public.library_fold(value text) returns text language sql immutable strict parallel safe
set search_path = '' as $$
  select trim(regexp_replace(translate(regexp_replace(lower(normalize(value,NFKD)), U&'[\0300-\036f]', '', 'g'), 'ёіқғңұүөһә', 'еикгнууоха'), '[^[:alnum:]]+', ' ', 'g'));
$$;
-- Natural title ordering ("Book 2" before "Book 10") with a stable ID tie-breaker.
create or replace function public.library_natural(value text) returns text language sql immutable strict parallel safe
set search_path = '' as $$
  select string_agg(case when part[1] ~ '^[0-9]+$' then lpad(part[1],20,'0') else part[1] end,'' order by ord)
  from regexp_matches(public.library_fold(value), '([0-9]+|[^0-9]+)', 'g') with ordinality as m(part,ord);
$$;

create or replace function public.library_page(p_queries text[] default '{}', p_grade integer default null,
  p_subject uuid default null, p_offset integer default 0, p_favorites boolean default false,
  p_collection uuid default null, p_secret boolean default false)
returns jsonb language plpgsql stable security invoker set search_path = public,extensions as $$
declare answer jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_offset < 0 or p_offset > 100000 or cardinality(p_queries)>5 or exists(select 1 from unnest(p_queries) q where char_length(q)>100) then raise exception 'Invalid search'; end if;
  with catalog as (
    select b.id,b.title,b.description,b.tags,b.quarter,b.grade,b.subject_id,b.author,b.publisher,
      array(select distinct v.language from public.book_variants v where v.book_id=b.id and v.publication_status='published' order by v.language) languages,
      exists(select 1 from public.library_favorites f where f.book_id=b.id and f.user_id=auth.uid()) favorite,
      array(select cb.collection_id from public.library_collection_books cb where cb.book_id=b.id and cb.user_id=auth.uid()) collection_ids,
      public.library_fold(b.title) title_search,
      public.library_fold(concat_ws(' ',b.title,b.author,b.publisher,array_to_string(b.tags,' '),s.name,s.name_ru,s.name_kz,s.name_en)) metadata_search
    from public.books b join public.subjects s on s.id=b.subject_id
    where b.publication_status='published'
      and exists(select 1 from public.book_variants v where v.book_id=b.id and v.publication_status='published')
      and (p_grade is null or b.grade=p_grade) and (p_subject is null or b.subject_id=p_subject)
      and ((p_secret and public.library_fold(b.title)=public.library_fold('Проза о Tamerlane Esentaeve третем'))
        or (not p_secret and public.library_fold(b.title)<>public.library_fold('Проза о Tamerlane Esentaeve третем')))
      and (not p_favorites or exists(select 1 from public.library_favorites f where f.book_id=b.id and f.user_id=auth.uid()))
      and (p_collection is null or exists(select 1 from public.library_collection_books cb where cb.book_id=b.id and cb.collection_id=p_collection and cb.user_id=auth.uid()))
  ), scored as (
    select c.*, coalesce(r.rank,9) rank,coalesce(r.sim,0) sim from catalog c
    left join lateral (
      select min(case when c.title_search=q then 0 when starts_with(c.title_search,q) then 1
        when strpos(c.title_search,q)>0 then 2
        when not exists(select 1 from unnest(string_to_array(q,' ')) token where strpos(c.metadata_search,token)=0) then 3
        when char_length(q)>=3 and word_similarity(q,c.title_search)>=0.42 then 4
        when char_length(q)>=4 and word_similarity(q,c.metadata_search)>=0.52 then 5
        when char_length(q)>=3 and strpos(public.library_fold(coalesce(c.description,'')),q)>0 then 6 else 9 end) rank,
        max(word_similarity(q,c.title_search)) sim
      from unnest(p_queries) q where q<>''
    ) r on true
  ), matched as (
    select * from scored where cardinality(p_queries)=0 or p_secret or rank<9
      or (p_queries[1] ~ '^(7|8|9|10|11|12)$' and grade::text=p_queries[1])
      or (p_queries[1] ~ '^[1-4]$' and quarter::text=p_queries[1])
  ), page as (
    select * from matched order by rank,case when rank>=4 then sim else 0 end desc,public.library_natural(title),id limit 24 offset p_offset
  )
  select jsonb_build_object('books',coalesce((select jsonb_agg(to_jsonb(page)-'title_search'-'metadata_search'-'rank'-'sim') from page),'[]'::jsonb),
    'total',(select count(*) from matched),
    'nextOffset',case when (select count(*) from matched)>p_offset+24 then p_offset+24 else null end,
    'suggestions',case when exists(select 1 from matched) then '[]'::jsonb else coalesce((select jsonb_agg(title) from (select title from scored where sim>=0.30 and char_length(p_queries[1])>=4 order by sim desc,public.library_natural(title) limit 3) suggestions),'[]'::jsonb) end)
  into answer;
  return answer;
end $$;
revoke all on function public.library_page(text[],integer,uuid,integer,boolean,uuid,boolean) from public,anon;
grant execute on function public.library_page(text[],integer,uuid,integer,boolean,uuid,boolean) to authenticated;
commit;
