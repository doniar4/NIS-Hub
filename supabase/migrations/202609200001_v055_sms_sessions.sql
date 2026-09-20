-- Additive v0.5.5: overflow storage for encrypted SMS sessions only.
-- No IIN, password, plaintext cookies or grades belong in this table.
create table public.sms_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  id uuid not null unique default gen_random_uuid(),
  ciphertext text not null check (length(ciphertext) between 40 and 40000 and ciphertext like 'v1.%'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint sms_session_ttl check (expires_at > created_at and expires_at <= created_at + interval '30 minutes')
);
alter table public.sms_sessions enable row level security;
revoke all on public.sms_sessions from anon, authenticated;
grant select, delete on public.sms_sessions to authenticated;
create policy sms_session_owner_read on public.sms_sessions for select to authenticated
  using (user_id = (select auth.uid()) and expires_at > now());
create policy sms_session_owner_delete on public.sms_sessions for delete to authenticated
  using (user_id = (select auth.uid()));

create function public.save_sms_session(p_ciphertext text, p_expires timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_expires <= now() or p_expires > now() + interval '30 minutes' then
    raise exception 'Invalid expiry';
  end if;
  -- Bounded opportunistic expiry cleanup; also schedule the documented daily purge.
  delete from public.sms_sessions where user_id in (
    select user_id from public.sms_sessions where expires_at <= now() order by expires_at limit 100
  );
  insert into public.sms_sessions(user_id, ciphertext, expires_at)
  values(actor, p_ciphertext, p_expires)
  on conflict(user_id) do update set id = gen_random_uuid(), ciphertext = excluded.ciphertext,
    expires_at = excluded.expires_at, created_at = now()
  returning id into result;
  return result;
end $$;
revoke all on function public.save_sms_session(text,timestamptz) from public,anon;
grant execute on function public.save_sms_session(text,timestamptz) to authenticated;
create index sms_sessions_expiry on public.sms_sessions(expires_at);
