begin;

-- Users receive only their own bounded daily totals, never raw routes/devices
-- or another account's history. Existing admin-only table policies stay intact.
create index if not exists idx_activity_user_created_at
  on public.user_activity_logs(user_id, created_at);

create or replace function public.profile_activity_year()
returns table(day date, views bigint)
language sql stable security definer set search_path = ''
as $$
  select (a.created_at at time zone 'Asia/Oral')::date as day, count(*) as views
  from public.user_activity_logs a
  where auth.uid() is not null and a.user_id = auth.uid()
    and a.created_at >= (((now() at time zone 'Asia/Oral')::date - 370)::timestamp at time zone 'Asia/Oral')
    and a.created_at < (((now() at time zone 'Asia/Oral')::date + 1)::timestamp at time zone 'Asia/Oral')
  group by (a.created_at at time zone 'Asia/Oral')::date
  order by day;
$$;
revoke all on function public.profile_activity_year() from public, anon;
grant execute on function public.profile_activity_year() to authenticated;

commit;
