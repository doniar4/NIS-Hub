begin;
create table public.ai_study_daily_usage(
 user_id uuid not null references public.profiles(id) on delete cascade,
 day date not null, requests integer not null check(requests between 0 and 10),primary key(user_id,day)
);
create table public.ai_study_generations(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
 book_variant_id uuid not null references public.book_variants(id) on delete restrict,
 content_revision uuid not null, start_page integer not null,end_page integer not null,
 mode text not null check(mode in('summary','review','sor','soch','questions')),locale text not null check(locale in('ru','kk','en')),
 source_hash text not null check(source_hash ~ '^[0-9a-f]{64}$'),model_key text not null check(length(model_key) between 1 and 160),
 status text not null check(status in('pending','ready','failed')),
 response text check(length(response)<=60000),signature text check(signature ~ '^[0-9a-f]{64}$'),
 lease uuid not null default gen_random_uuid(),created_at timestamptz not null default now(),
 check(start_page>=1 and end_page>=start_page and end_page-start_page<10),
 unique(user_id,book_variant_id,content_revision,start_page,end_page,mode,locale,source_hash,model_key)
);
alter table public.ai_study_generations enable row level security;
alter table public.ai_study_daily_usage enable row level security;
revoke all on public.ai_study_generations,public.ai_study_daily_usage from public,anon,authenticated;
grant select on public.ai_study_generations,public.ai_study_daily_usage to authenticated;
create policy "Own AI usage" on public.ai_study_daily_usage for select to authenticated using(user_id=auth.uid());
create policy "Own current authorized AI cache" on public.ai_study_generations for select to authenticated using(user_id=auth.uid() and
 exists(select 1 from public.book_variants v join public.books b on b.id=v.book_id where v.id=book_variant_id
 and v.content_revision=ai_study_generations.content_revision and v.publication_status='published' and b.publication_status='published'));

create function public.reserve_ai_study(p_variant uuid,p_revision uuid,p_start integer,p_end integer,p_mode text,p_locale text,p_hash text,p_model text,p_limit integer default 10)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); computed text; n integer; chars bigint; g public.ai_study_generations; used integer;
begin
 if uid is null then raise exception 'Sign in required' using errcode='42501';end if;
 if p_start is null or p_end is null or p_start<1 or p_end<p_start or p_end-p_start>=10
 or p_mode is null or p_mode not in('summary','review','sor','soch','questions') or p_locale is null or p_locale not in('ru','kk','en')
 or p_hash is null or p_model is null or length(p_model) not between 1 and 160 then raise exception 'Invalid selection';end if;
 -- Serialize all reservations for one user, including identical requests and quota.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 perform 1 from public.book_variants v join public.books b on b.id=v.book_id join public.book_extractions e on e.book_variant_id=v.id
 where v.id=p_variant and v.content_revision=p_revision and e.content_revision=p_revision and e.status='ready'
 and v.publication_status='published' and b.publication_status='published' for share of v,b,e;
 if not found then raise exception 'Source unavailable' using errcode='42501';end if;
 select count(*),coalesce(sum(length(text)),0),encode(sha256(convert_to(string_agg(page_number::text||':'||text_hash,',' order by page_number),'UTF8')),'hex')
 into n,chars,computed from public.book_pages where book_variant_id=p_variant and content_revision=p_revision and page_number between p_start and p_end;
 if n<>p_end-p_start+1 or chars<80 or chars>30000 or computed is distinct from p_hash then raise exception 'Source unavailable';end if;
 select * into g from public.ai_study_generations where user_id=uid and book_variant_id=p_variant and content_revision=p_revision and
 start_page=p_start and end_page=p_end and mode=p_mode and locale=p_locale and source_hash=p_hash and model_key=p_model for update;
 if g.status='ready' then return jsonb_build_object('state','cached','generation',to_jsonb(g));end if;
 if g.status='pending' and g.created_at>now()-interval '2 minutes' then return jsonb_build_object('state','busy');end if;
 insert into public.ai_study_daily_usage(user_id,day,requests) values(uid,(now() at time zone 'Asia/Oral')::date,1)
 on conflict(user_id,day) do update set requests=public.ai_study_daily_usage.requests+1
 where public.ai_study_daily_usage.requests<least(10,greatest(1,coalesce(p_limit,10))) returning requests into used;
 if used is null then return jsonb_build_object('state','quota');end if;
 insert into public.ai_study_generations(user_id,book_variant_id,content_revision,start_page,end_page,mode,locale,source_hash,model_key,status)
 values(uid,p_variant,p_revision,p_start,p_end,p_mode,p_locale,p_hash,p_model,'pending')
 on conflict(user_id,book_variant_id,content_revision,start_page,end_page,mode,locale,source_hash,model_key)
 do update set status='pending',response=null,signature=null,lease=gen_random_uuid(),created_at=now() returning * into g;
 return jsonb_build_object('state','reserved','generation',to_jsonb(g));
end;$$;
create function public.complete_ai_study(p_id uuid,p_lease uuid,p_response text,p_signature text,p_failed boolean default false)
returns boolean language plpgsql security definer set search_path='' as $$
declare g public.ai_study_generations;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501';end if;
 select * into g from public.ai_study_generations where id=p_id and user_id=auth.uid() and lease=p_lease and status='pending' for update;
 if not found then return false;end if;
 if not p_failed then
  if p_response is null or length(p_response)>60000 or p_signature is null or p_signature!~'^[0-9a-f]{64}$' then raise exception 'Invalid result';end if;
  perform 1 from public.book_variants v join public.books b on b.id=v.book_id where v.id=g.book_variant_id and v.content_revision=g.content_revision
  and v.publication_status='published' and b.publication_status='published' for share of v,b;
  if not found then return false;end if;
 end if;
 update public.ai_study_generations set status=case when p_failed then 'failed' else 'ready' end,
 response=case when p_failed then null else p_response end,signature=case when p_failed then null else p_signature end where id=g.id;
 return true;
end;$$;
revoke all on function public.reserve_ai_study(uuid,uuid,integer,integer,text,text,text,text,integer),public.complete_ai_study(uuid,uuid,text,text,boolean) from public,anon;
grant execute on function public.reserve_ai_study(uuid,uuid,integer,integer,text,text,text,text,integer),public.complete_ai_study(uuid,uuid,text,text,boolean) to authenticated;
comment on table public.ai_study_generations is 'Own-user cache; server verifies HMAC before trusting a stored response. No service-role credential required. Quota counts reserved attempts, including failed provider calls.';
commit;
