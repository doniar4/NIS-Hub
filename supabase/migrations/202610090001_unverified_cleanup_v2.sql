begin;

-- Accounts shown as "Waiting for verification" in Supabase Auth for more than
-- 3 days are removed. Safe to rerun; reuses private.cleanup_unverified_accounts().
create schema if not exists private;

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

-- PostgREST-callable entry point for the Vercel Cron fallback (service role only).
create or replace function public.cleanup_unverified_accounts_job() returns integer
language sql security definer set search_path='' as $$
 select private.cleanup_unverified_accounts();
$$;
revoke all on function public.cleanup_unverified_accounts_job() from public,anon,authenticated;
grant execute on function public.cleanup_unverified_accounts_job() to service_role;

-- (Re)install the hourly pg_cron job when available.
do $install$
begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron with schema pg_catalog;
  if exists(select 1 from cron.job where jobname='nis-cleanup-unverified-accounts') then
   perform cron.unschedule('nis-cleanup-unverified-accounts');
  end if;
  perform cron.schedule('nis-cleanup-unverified-accounts','17 * * * *',
   'select private.cleanup_unverified_accounts();');
 else
  raise notice 'pg_cron unavailable: enable Supabase Cron or rely on /api/cron/cleanup-unverified';
 end if;
end;
$install$;

-- Remove the backlog immediately instead of waiting for the next run.
select private.cleanup_unverified_accounts();

commit;
