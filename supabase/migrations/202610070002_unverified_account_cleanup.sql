begin;

-- Runs inside Postgres: no Auth admin API pagination or network egress.
create function private.cleanup_unverified_accounts() returns integer
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
