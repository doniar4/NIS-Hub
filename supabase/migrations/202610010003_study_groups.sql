begin;

create table if not exists public.study_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  subject text not null check (char_length(btrim(subject)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.study_group_members (
  group_id uuid not null references public.study_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default clock_timestamp(),
  primary key (group_id, user_id)
);

create unique index if not exists study_group_single_owner
  on public.study_group_members(group_id) where role = 'owner';
create index if not exists study_group_members_user on public.study_group_members(user_id, joined_at desc);

create table if not exists public.study_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  client_id uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (sender_id, client_id)
);

create index if not exists study_group_message_history
  on public.study_group_messages(group_id, created_at desc, id desc);
create index if not exists study_group_message_rate
  on public.study_group_messages(sender_id, created_at desc);

alter table public.study_groups enable row level security;
alter table public.study_group_members enable row level security;
alter table public.study_group_messages enable row level security;

revoke all on public.study_groups, public.study_group_members, public.study_group_messages
  from anon, authenticated;
grant select on public.study_groups, public.study_group_members, public.study_group_messages
  to authenticated;

create or replace function public.is_study_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.study_group_members
    where group_id = p_group and user_id = auth.uid()
  );
$$;

drop policy if exists study_groups_members on public.study_groups;
drop policy if exists study_group_members_members on public.study_group_members;
drop policy if exists study_group_messages_members on public.study_group_messages;

create policy study_groups_members on public.study_groups
  for select to authenticated using (public.is_study_group_member(id));
create policy study_group_members_members on public.study_group_members
  for select to authenticated using (public.is_study_group_member(group_id));
create policy study_group_messages_members on public.study_group_messages
  for select to authenticated using (public.is_study_group_member(group_id));

-- A manually applied newer group migration may already have expanded these
-- RPC return rows. PostgreSQL cannot CREATE OR REPLACE an OUT-row type, so
-- recreate the baseline signatures explicitly; the next migration upgrades
-- them again in the same push.
drop function if exists public.study_group_inbox();
drop function if exists public.study_group_history(uuid,timestamptz,uuid,text);
drop function if exists public.study_group_history(uuid,timestamptz,uuid);
drop function if exists public.send_study_group_message(uuid,text,uuid,uuid);
drop function if exists public.send_study_group_message(uuid,text,uuid);
drop function if exists public.create_study_group(text,text,text,text[],integer,integer);
drop function if exists public.create_study_group(text,text,text,text[]);

create or replace function public.create_study_group(
  p_name text,
  p_subject text,
  p_description text default '',
  p_members text[] default '{}'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  gid uuid;
  requested text[];
  resolved integer;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if not exists(select 1 from public.profiles where id = uid and nullif(btrim(display_name), '') is not null)
    then raise exception 'name_required'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80
    or p_subject is null or char_length(btrim(p_subject)) not between 1 and 80
    or p_description is null or char_length(p_description) > 500
    then raise exception 'invalid_group'; end if;

  select coalesce(array_agg(distinct lower(btrim(value))), '{}') into requested
  from unnest(coalesce(p_members, '{}')) value
  where nullif(btrim(value), '') is not null;
  if cardinality(requested) > 30 then raise exception 'member_limit'; end if;
  select count(*) into resolved from public.profiles where lower(btrim(display_name)) = any(requested);
  if resolved <> cardinality(requested) then raise exception 'member_unavailable'; end if;

  perform pg_advisory_xact_lock(hashtextextended(uid::text, 731));
  if (select count(*) from public.study_groups where owner_id = uid) >= 20
    then raise exception 'group_limit'; end if;

  insert into public.study_groups(owner_id, name, subject, description)
  values(uid, btrim(p_name), btrim(p_subject), btrim(p_description)) returning id into gid;
  insert into public.study_group_members(group_id, user_id, role) values(gid, uid, 'owner');
  insert into public.study_group_members(group_id, user_id)
  select gid, id from public.profiles
  where lower(btrim(display_name)) = any(requested) and id <> uid
  on conflict do nothing;
  return gid;
end;
$$;

create or replace function public.study_group_inbox()
returns table(id uuid, name text, subject text, description text, members_count bigint, owner boolean, last_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name, g.subject, g.description,
    (select count(*) from public.study_group_members m where m.group_id = g.id),
    g.owner_id = auth.uid(),
    coalesce((select max(created_at) from public.study_group_messages x where x.group_id = g.id), g.created_at)
  from public.study_groups g
  where public.is_study_group_member(g.id)
  order by 7 desc, g.id desc
  limit 100;
$$;

create or replace function public.study_group_history(p_group uuid, p_before timestamptz default null, p_id uuid default null)
returns table(id uuid, group_id uuid, sender_id uuid, author text, body text, client_id uuid, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_study_group_member(p_group) then raise exception 'group_unavailable'; end if;
  return query
    select m.id, m.group_id, m.sender_id, coalesce(p.display_name, 'Участник'), m.body, m.client_id, m.created_at
    from public.study_group_messages m join public.profiles p on p.id = m.sender_id
    where m.group_id = p_group and (
      p_before is null or (m.created_at, m.id) < (p_before, coalesce(p_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
    order by m.created_at desc, m.id desc limit 51;
end;
$$;

create or replace function public.send_study_group_message(p_group uuid, p_body text, p_client uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); mid uuid; existing public.study_group_messages;
begin
  if uid is null or not public.is_study_group_member(p_group) then raise exception 'group_unavailable'; end if;
  if p_client is null or p_body is null or char_length(btrim(p_body)) not between 1 and 2000
    then raise exception 'invalid_message'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 732));
  select * into existing from public.study_group_messages where sender_id = uid and client_id = p_client;
  if existing.id is not null then
    if existing.group_id <> p_group or existing.body <> btrim(p_body) then raise exception 'invalid_message'; end if;
    return existing.id;
  end if;
  if (select count(*) from public.study_group_messages where sender_id = uid and created_at > now() - interval '1 minute') >= 20
    then raise exception 'rate_limit'; end if;
  insert into public.study_group_messages(group_id, sender_id, body, client_id)
  values(p_group, uid, btrim(p_body), p_client) returning id into mid;
  return mid;
end;
$$;

revoke all on function public.is_study_group_member(uuid), public.create_study_group(text,text,text,text[]),
  public.study_group_inbox(), public.study_group_history(uuid,timestamptz,uuid),
  public.send_study_group_message(uuid,text,uuid) from public, anon;
grant execute on function public.is_study_group_member(uuid), public.create_study_group(text,text,text,text[]),
  public.study_group_inbox(), public.study_group_history(uuid,timestamptz,uuid),
  public.send_study_group_message(uuid,text,uuid) to authenticated;

commit;
