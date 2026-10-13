-- NIS Hub: apply ONLY these two new migrations to an existing project.
-- Generated from the migration files; do not apply both formats.

-- 202610070001_message_avatars.sql
begin;

-- Preserve the v053 contract for older clients. No emails or private profile fields.
create or replace function public.dm_inbox_v2() returns table(
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
create or replace function public.can_read_dm_avatar(p_name text) returns boolean
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
drop policy if exists "Read allowed DM peer avatar" on storage.objects;
create policy "Read allowed DM peer avatar" on storage.objects
 for select to authenticated using (
  bucket_id='avatars' and public.can_read_dm_avatar(name)
 );
notify pgrst,'reload schema';
commit;


-- 202610070002_unverified_account_cleanup.sql
begin;

-- Runs inside Postgres: no Auth admin API pagination or network egress.
create or replace function private.cleanup_unverified_accounts() returns integer
language plpgsql security definer set search_path='' as $$
declare candidate uuid; removed integer:=0;
begin
 for candidate in
  select u.id from auth.users u
  where u.created_at < now()-interval '3 days'
   and u.email is not null and u.email_confirmed_at is null
   and u.phone_confirmed_at is null and u.last_sign_in_at is null
   and not coalesce(u.is_anonymous,false)
   and coalesce(u.raw_app_meta_data->>'provider','email')='email'
   and not exists(select 1 from public.profiles p where p.id=u.id and p.role='admin')
  order by u.created_at,u.id limit 500 for update of u skip locked
 loop
  begin
   -- Recheck confirmation at deletion; preserve Storage ownership/FK integrity.
   delete from auth.users where id=candidate
    and email_confirmed_at is null and phone_confirmed_at is null
    and last_sign_in_at is null;
   if found then removed:=removed+1; end if;
  exception when foreign_key_violation then
   -- An exceptional account with retained content must not stop the batch.
   null;
  end;
 end loop;
 return removed;
end;
$$;
revoke all on function private.cleanup_unverified_accounts() from public,anon,authenticated;

-- Supabase provides pg_cron; embedded SQL test engines may not provide it.
do $install$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('nis-cleanup-unverified-accounts','17 * * * *',
   'select private.cleanup_unverified_accounts();');
 else
  raise notice 'pg_cron unavailable: enable Supabase Cron and schedule private.cleanup_unverified_accounts() hourly';
 end if;
end;
$install$;
commit;
