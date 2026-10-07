begin;

-- Preserve the v053 contract for older clients. No emails or private profile fields.
create function public.dm_inbox_v2() returns table(
 id uuid,peer_id uuid,peer_name text,last_body text,last_deleted boolean,
 last_at timestamptz,unread bigint,blocked boolean,peer_avatar_path text,
 peer_avatar_updated_at timestamptz,last_sender_id uuid
)
language sql stable security definer set search_path='' as $$
 select d.*,case when not d.blocked then p.avatar_path end,
 case when not d.blocked then p.updated_at end,m.sender_id
 from public.dm_inbox_v053() d join public.profiles p on p.id=d.peer_id
 left join lateral(
  select sender_id from public.direct_messages where thread_id=d.id
  order by created_at desc,id desc limit 1
 )m on true
 order by d.last_at desc,d.id limit 200;
$$;
revoke all on function public.dm_inbox_v2() from public,anon;
grant execute on function public.dm_inbox_v2() to authenticated;

-- Private bucket: only canonical images belonging to an allowed DM peer.
create function public.can_read_dm_avatar(p_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.profiles p join public.dm_threads t
   on (t.participant_a=auth.uid() and t.participant_b=p.id)
   or (t.participant_b=auth.uid() and t.participant_a=p.id)
  where p.avatar_path=p_name and p_name=p.id::text||'/avatar.webp'
   and public.community_pair_allowed(auth.uid(),p.id)
   and not exists(select 1 from public.dm_thread_preferences pref
    where pref.thread_id=t.id and pref.user_id=auth.uid() and pref.hidden)
 );
$$;
revoke all on function public.can_read_dm_avatar(text) from public,anon;
grant execute on function public.can_read_dm_avatar(text) to authenticated;
create policy "Read allowed DM peer avatar" on storage.objects
 for select to authenticated using (
  bucket_id='avatars' and public.can_read_dm_avatar(name)
 );
notify pgrst,'reload schema';
commit;
