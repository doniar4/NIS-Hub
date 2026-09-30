-- Keep an encrypted SMS login for up to two hours, bounded by the upstream
-- cookie expiry. Credentials and grade data are still never stored here.
alter table public.sms_sessions drop constraint sms_session_ttl;
alter table public.sms_sessions add constraint sms_session_ttl
  check (expires_at > created_at and expires_at <= created_at + interval '2 hours');

create or replace function public.save_sms_session(p_ciphertext text, p_expires timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); result uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_expires <= now() or p_expires > now() + interval '2 hours' then
    raise exception 'Invalid expiry';
  end if;
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
