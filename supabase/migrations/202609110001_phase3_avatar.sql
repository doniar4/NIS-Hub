-- Apply after Phase 2. Tightens only avatars; book policies are unchanged.
begin;
-- Stop rather than silently orphan, move or delete existing user images.
do $$ begin
  if exists(select 1 from public.profiles where avatar_path is not null and avatar_path <> id::text || '/avatar.webp')
    or exists(select 1 from storage.objects where bucket_id='avatars' and name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar\.webp$')
  then raise exception 'Resolve legacy avatars through Storage API before Phase 3; see docs/supabase-setup.md'; end if;
end $$;
alter table public.profiles add constraint canonical_avatar_path
  check (avatar_path is null or avatar_path = id::text || '/avatar.webp');
update storage.buckets set public=false, file_size_limit=262144, allowed_mime_types=array['image/webp'] where id='avatars';

drop policy "Users read their own avatar" on storage.objects;
drop policy "Users upload their own avatar" on storage.objects;
drop policy "Users update their own avatar" on storage.objects;
drop policy "Users delete their own avatar" on storage.objects;
create policy "Read canonical own avatar" on storage.objects for select to authenticated
using (bucket_id='avatars' and name=(select auth.uid()::text) || '/avatar.webp');
create policy "Insert canonical own avatar" on storage.objects for insert to authenticated
with check (bucket_id='avatars' and name=(select auth.uid()::text) || '/avatar.webp');
-- Practical sequential cooldown enforced outside the browser. Storage's upload
-- preflight is not a transactional concurrent rate limiter; see phase-3 report.
create policy "Replace canonical own avatar after cooldown" on storage.objects for update to authenticated
using (bucket_id='avatars' and name=(select auth.uid()::text) || '/avatar.webp'
  and updated_at <= now() - interval '60 seconds')
with check (bucket_id='avatars' and name=(select auth.uid()::text) || '/avatar.webp');
-- No DELETE policy: prevents delete/reinsert bypass and accidental removal.

create function private.check_avatar_object() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.avatar_path is not null and not exists (
    select 1 from storage.objects where bucket_id='avatars' and name=new.avatar_path
  ) then raise exception 'Avatar upload must succeed before setting profile path' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function private.check_avatar_object() from public, anon, authenticated;
create trigger profile_avatar_exists before insert or update of avatar_path on public.profiles
for each row execute function private.check_avatar_object();
commit;
