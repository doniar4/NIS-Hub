begin;
-- Foundation for the safe projection. Operations are added in migration 002.
create table public.user_blocks (
 blocker_id uuid not null references public.profiles(id) on delete cascade,
 blocked_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public,anon,authenticated;
grant select on public.user_blocks to authenticated;
create policy own_blocks on public.user_blocks for select to authenticated using(blocker_id=auth.uid());
create index user_blocks_reverse on public.user_blocks(blocked_id,blocker_id);

create function public.community_pair_allowed(a uuid,b uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() in(a,b) and not exists(select 1 from public.user_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
revoke all on function public.community_pair_allowed(uuid,uuid) from public,anon;
grant execute on function public.community_pair_allowed(uuid,uuid) to authenticated;

create table public.friendships (
 user_a uuid not null references public.profiles(id) on delete cascade,
 user_b uuid not null references public.profiles(id) on delete cascade,
 requested_by uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'pending' check(status in('pending','accepted')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(user_a,user_b), check(user_a<user_b), check(requested_by in(user_a,user_b))
);
alter table public.friendships enable row level security;
revoke all on public.friendships from public,anon,authenticated;
grant select on public.friendships to authenticated;
create policy own_friendships on public.friendships for select to authenticated
 using(auth.uid() in(user_a,user_b) and public.community_pair_allowed(user_a,user_b));
create index friendships_b on public.friendships(user_b);

-- Keep the old RPC working for older clients. New Bio update is atomic with Top 4.
create function public.save_profile_v053(p_name text,p_class uuid,p_subjects uuid[],p_bio text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_bio is null or char_length(p_bio)>280 then raise exception 'invalid_bio'; end if;
 perform public.save_profile(p_name,p_class,p_subjects);
 update public.profiles set bio=nullif(btrim(p_bio),'') where id=auth.uid();
end $$;
revoke all on function public.save_profile_v053(text,uuid,uuid[],text) from public,anon;
grant execute on function public.save_profile_v053(text,uuid,uuid[],text) to authenticated;

-- Whitelisted projection only; raw profiles/Top 4 SELECT policies are unchanged.
create function public.people_list(p_scope text default 'search',p_query text default '',p_id uuid default null,p_offset integer default 0)
returns table(id uuid,display_name text,bio text,top_subjects uuid[],relationship text)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if p_scope not in('search','profile','friends','requests','blocked') or p_scope is null
  or p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'invalid_input'; end if;
 if p_scope='search' and (p_query is null or char_length(btrim(p_query)) not between 2 and 60) then return; end if;
 return query
 select p.id,p.display_name,case when p_scope='blocked' then null else p.bio end,
   case when p_scope='blocked' then '{}'::uuid[] else coalesce((select array_agg(s.subject_id order by s.position) from public.profile_top_subjects s where s.profile_id=p.id),'{}'::uuid[]) end,
   case when p.id=auth.uid() then 'self' when p_scope='blocked' then 'blocked'
        when f.status='accepted' then 'friend' when f.requested_by=auth.uid() then 'outgoing'
        when f.status='pending' then 'incoming' else 'none' end
 from public.profiles p
 left join public.friendships f on f.user_a=least(p.id,auth.uid()) and f.user_b=greatest(p.id,auth.uid())
 where p.display_name is not null
 and (case when p_scope='blocked' then exists(select 1 from public.user_blocks b where b.blocker_id=auth.uid() and b.blocked_id=p.id)
           else public.community_pair_allowed(auth.uid(),p.id) end)
 and (case p_scope
  when 'search' then p.id<>auth.uid() and strpos(lower(p.display_name),lower(btrim(p_query)))>0
  when 'profile' then p.id=p_id
  when 'friends' then f.status='accepted'
  when 'requests' then f.status='pending'
  when 'blocked' then true else false end)
 order by lower(p.display_name),p.id limit 12 offset p_offset;
end $$;
revoke all on function public.people_list(text,text,uuid,integer) from public,anon;
grant execute on function public.people_list(text,text,uuid,integer) to authenticated;

create table public.friend_request_events (
 user_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index friend_request_rate on public.friend_request_events(user_id,created_at);
alter table public.friend_request_events enable row level security;
revoke all on public.friend_request_events from public,anon,authenticated;

create function public.friend_action(p_peer uuid,p_action text) returns void
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a uuid:=least(uid,p_peer); b uuid:=greatest(uid,p_peer); f public.friendships;
begin
 if uid is null then raise exception 'authentication_required'; end if;
 if p_peer is null or p_peer=uid or not exists(select 1 from public.profiles where id=p_peer and display_name is not null) then raise exception 'unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(a::text||b::text,753));
 if not public.community_pair_allowed(uid,p_peer) then raise exception 'unavailable'; end if;
 select * into f from public.friendships where user_a=a and user_b=b for update;
 if p_action='request' then
  if f.user_a is not null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,754));
  if (select count(*) from public.friend_request_events where user_id=uid and created_at>now()-interval '1 day')>=30 then raise exception 'rate_limit'; end if;
  insert into public.friendships(user_a,user_b,requested_by) values(a,b,uid);
  insert into public.friend_request_events(user_id) values(uid);
 elsif p_action='accept' then
  if f.status is distinct from 'pending' or f.requested_by=uid then raise exception 'unavailable'; end if;
  update public.friendships set status='accepted',updated_at=now() where user_a=a and user_b=b;
 elsif p_action='remove' then
  delete from public.friendships where user_a=a and user_b=b;
 else raise exception 'invalid_action';
 end if;
end $$;
revoke all on function public.friend_action(uuid,text) from public,anon;
grant execute on function public.friend_action(uuid,text) to authenticated;
commit;
