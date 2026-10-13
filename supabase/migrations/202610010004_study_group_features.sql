begin;

alter table public.study_groups
  add column if not exists avatar_icon smallint not null default 0 check (avatar_icon between 0 and 11),
  add column if not exists avatar_color smallint not null default 0 check (avatar_color between 0 and 7),
  add column if not exists admins_only_post boolean not null default false,
  add column if not exists members_can_invite boolean not null default false;

alter table public.study_group_members drop constraint if exists study_group_members_role_check;
alter table public.study_group_members
  add constraint study_group_members_role_check check (role in ('owner','admin','member')),
  add column if not exists notifications_muted boolean not null default false,
  add column if not exists last_read_at timestamptz;

alter table public.study_group_messages
  add column if not exists reply_to uuid references public.study_group_messages(id) on delete set null,
  add column if not exists deleted_at timestamptz;

alter table public.study_groups
  add column if not exists pinned_message_id uuid references public.study_group_messages(id) on delete set null;

create table if not exists public.study_group_reactions (
  message_id uuid not null references public.study_group_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji smallint not null check (emoji between 0 and 7),
  created_at timestamptz not null default clock_timestamp(),
  primary key(message_id,user_id,emoji)
);
create index if not exists study_group_reactions_user on public.study_group_reactions(user_id);

create table if not exists public.study_group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.study_groups(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid references public.profiles(id) on delete cascade,
  code text,
  status text not null default 'pending' check(status in('pending','accepted','declined','revoked')),
  expires_at timestamptz not null,
  max_uses smallint not null default 1 check(max_uses between 1 and 100),
  uses smallint not null default 0 check(uses>=0 and uses<=max_uses),
  created_at timestamptz not null default clock_timestamp(),
  check((invitee_id is not null and code is null and max_uses=1) or (invitee_id is null and code ~ '^[A-Z2-9]{8}$'))
);
create unique index if not exists study_group_pending_invitee
  on public.study_group_invites(group_id,invitee_id) where invitee_id is not null and status='pending';
create unique index if not exists study_group_invite_code
  on public.study_group_invites(code) where code is not null and status='pending';
create index if not exists study_group_invites_inbox on public.study_group_invites(invitee_id,created_at desc);

create table if not exists public.study_group_audit (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.study_groups(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action smallint not null check(action between 0 and 15),
  target_id uuid,
  detail jsonb not null default '{}'::jsonb check(octet_length(detail::text)<=1000),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists study_group_audit_recent on public.study_group_audit(group_id,created_at desc);

-- These RPCs gain additional OUT columns/arguments in this migration, so PostgreSQL
-- requires replacing their signatures explicitly rather than CREATE OR REPLACE.
drop function if exists public.study_group_inbox();
drop function if exists public.study_group_history(uuid,timestamptz,uuid);
drop function if exists public.send_study_group_message(uuid,text,uuid);
drop function if exists public.create_study_group(text,text,text,text[]);
drop function if exists public.create_study_group(text,text,text,text[],smallint,smallint);
drop function if exists public.update_study_group(uuid,text,text,text,smallint,smallint,boolean,boolean);
drop function if exists public.toggle_study_group_reaction(uuid,smallint);

alter table public.study_group_reactions enable row level security;
alter table public.study_group_invites enable row level security;
alter table public.study_group_audit enable row level security;
revoke all on public.study_group_reactions,public.study_group_invites,public.study_group_audit from anon,authenticated;
grant select on public.study_group_reactions,public.study_group_invites,public.study_group_audit to authenticated;

create or replace function public.study_group_role(p_group uuid)
returns text language sql stable security definer set search_path='' as $$
 select role from public.study_group_members where group_id=p_group and user_id=auth.uid();
$$;
create or replace function public.study_group_can_manage(p_group uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.study_group_role(p_group) in ('owner','admin'),false);
$$;
create or replace function public.study_group_can_invite(p_group uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(public.study_group_can_manage(p_group) or (
  public.study_group_role(p_group)='member' and (select members_can_invite from public.study_groups where id=p_group)
 ),false);
$$;

drop policy if exists study_group_reactions_members on public.study_group_reactions;
drop policy if exists study_group_invites_visible on public.study_group_invites;
drop policy if exists study_group_audit_managers on public.study_group_audit;
create policy study_group_reactions_members on public.study_group_reactions for select to authenticated
 using(exists(select 1 from public.study_group_messages m where m.id=message_id and public.is_study_group_member(m.group_id)));
create policy study_group_invites_visible on public.study_group_invites for select to authenticated
 using(invitee_id=auth.uid() or public.study_group_can_manage(group_id));
create policy study_group_audit_managers on public.study_group_audit for select to authenticated
 using(public.study_group_can_manage(group_id));

create or replace function public.study_group_log(p_group uuid,p_action integer,p_target uuid default null,p_detail jsonb default '{}')
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.study_group_audit(group_id,actor_id,action,target_id,detail)
 values(p_group,auth.uid(),p_action,p_target,coalesce(p_detail,'{}'));
 delete from public.study_group_audit where id in(
  select id from public.study_group_audit where group_id=p_group order by created_at desc,id desc offset 200
 );
end $$;

create or replace function public.create_study_group(
 p_name text,p_subject text,p_description text default '',p_members text[] default '{}',
 p_avatar_icon integer default 0,p_avatar_color integer default 0
) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();gid uuid;person record;requested text[];
begin
 if uid is null then raise exception 'authentication_required'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 80 or p_subject is null or char_length(btrim(p_subject)) not between 1 and 80
  or p_description is null or char_length(p_description)>500 or p_avatar_icon not between 0 and 11 or p_avatar_color not between 0 and 7 then raise exception 'invalid_group'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,731));
 if (select count(*) from public.study_groups where owner_id=uid)>=20 then raise exception 'group_limit'; end if;
 insert into public.study_groups(owner_id,name,subject,description,avatar_icon,avatar_color)
 values(uid,btrim(p_name),btrim(p_subject),btrim(p_description),p_avatar_icon,p_avatar_color) returning id into gid;
 insert into public.study_group_members(group_id,user_id,role) values(gid,uid,'owner');
 select coalesce(array_agg(distinct lower(btrim(v))),'{}') into requested from unnest(coalesce(p_members,'{}')) v where nullif(btrim(v),'') is not null;
 if cardinality(requested)>30 then raise exception 'member_limit'; end if;
 for person in select id from public.profiles where lower(btrim(display_name))=any(requested) and id<>uid loop
  if public.community_pair_allowed(uid,person.id) then
   insert into public.study_group_invites(group_id,inviter_id,invitee_id,expires_at) values(gid,uid,person.id,now()+interval '14 days') on conflict do nothing;
  end if;
 end loop;
 perform public.study_group_log(gid,0,null,jsonb_build_object('name',btrim(p_name)));
 return gid;
end $$;

create or replace function public.study_group_friends(p_group uuid)
returns table(id uuid,display_name text,invited boolean,member boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.study_group_can_invite(p_group) then raise exception 'group_unavailable'; end if;
 return query select p.id,p.display_name,
  exists(select 1 from public.study_group_invites i where i.group_id=p_group and i.invitee_id=p.id and i.status='pending' and i.expires_at>now()),
  exists(select 1 from public.study_group_members m where m.group_id=p_group and m.user_id=p.id)
 from public.friendships f join public.profiles p on p.id=case when f.user_a=auth.uid() then f.user_b else f.user_a end
 where auth.uid() in(f.user_a,f.user_b) and f.status='accepted' and public.community_pair_allowed(auth.uid(),p.id)
 order by lower(p.display_name),p.id limit 100;
end $$;

create or replace function public.study_group_people(p_group uuid,p_query text)
returns table(id uuid,display_name text,friend boolean,invited boolean,member boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.study_group_can_invite(p_group) or char_length(btrim(coalesce(p_query,''))) not between 2 and 60 then raise exception 'group_unavailable'; end if;
 return query select p.id,p.display_name,
  exists(select 1 from public.friendships f where f.status='accepted' and auth.uid() in(f.user_a,f.user_b) and p.id in(f.user_a,f.user_b)),
  exists(select 1 from public.study_group_invites i where i.group_id=p_group and i.invitee_id=p.id and i.status='pending' and i.expires_at>now()),
  exists(select 1 from public.study_group_members m where m.group_id=p_group and m.user_id=p.id)
 from public.profiles p
 where p.id<>auth.uid() and lower(p.display_name) like '%'||lower(btrim(p_query))||'%' and public.community_pair_allowed(auth.uid(),p.id)
 order by (lower(p.display_name)=lower(btrim(p_query))) desc,lower(p.display_name),p.id limit 30;
end $$;

create or replace function public.invite_study_group_members(p_group uuid,p_users uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();peer uuid;added integer:=0;
begin
 if not public.study_group_can_invite(p_group) or cardinality(coalesce(p_users,'{}'))>30 then raise exception 'group_unavailable'; end if;
 foreach peer in array coalesce(p_users,'{}') loop
  if peer<>uid and exists(select 1 from public.profiles where id=peer) and public.community_pair_allowed(uid,peer)
   and not exists(select 1 from public.study_group_members where group_id=p_group and user_id=peer) then
   insert into public.study_group_invites(group_id,inviter_id,invitee_id,expires_at) values(p_group,uid,peer,now()+interval '14 days')
   on conflict(group_id,invitee_id) where invitee_id is not null and status='pending'
   do update set inviter_id=excluded.inviter_id,expires_at=excluded.expires_at;
   added:=added+1;
  end if;
 end loop;
 if added>0 then perform public.study_group_log(p_group,1,null,jsonb_build_object('count',added)); end if;
 return added;
end $$;

create or replace function public.study_group_invitation_inbox()
returns table(id uuid,group_id uuid,group_name text,inviter_name text,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
 select i.id,i.group_id,g.name,p.display_name,i.expires_at from public.study_group_invites i
 join public.study_groups g on g.id=i.group_id join public.profiles p on p.id=i.inviter_id
 where i.invitee_id=auth.uid() and i.status='pending' and i.expires_at>now()
 and public.community_pair_allowed(i.inviter_id,auth.uid()) order by i.created_at desc limit 50;
$$;

create or replace function public.respond_study_group_invite(p_invite uuid,p_accept boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare row public.study_group_invites;
begin
 select * into row from public.study_group_invites where id=p_invite and invitee_id=auth.uid() and status='pending' and expires_at>now() for update;
 if row.id is null or p_accept is null or not public.community_pair_allowed(row.inviter_id,auth.uid()) then raise exception 'invite_unavailable'; end if;
 update public.study_group_invites set status=case when p_accept then 'accepted' else 'declined' end,uses=case when p_accept then 1 else 0 end where id=row.id;
 if p_accept then insert into public.study_group_members(group_id,user_id) values(row.group_id,auth.uid()) on conflict do nothing; end if;
 perform public.study_group_log(row.group_id,case when p_accept then 2 else 3 end,auth.uid());
 return row.group_id;
end $$;

create or replace function public.create_study_group_code(p_group uuid,p_hours integer,p_max_uses integer)
returns text language plpgsql security definer set search_path='' as $$
declare result text;alphabet text:='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';i integer;
begin
 if not public.study_group_can_manage(p_group) or p_hours not between 1 and 168 or p_max_uses not between 1 and 100 then raise exception 'group_unavailable'; end if;
 update public.study_group_invites set status='revoked' where group_id=p_group and invitee_id is null and status='pending';
 loop
  result:='';for i in 1..8 loop result:=result||substr(alphabet,1+floor(random()*length(alphabet))::integer,1);end loop;
  exit when not exists(select 1 from public.study_group_invites where code=result and status='pending');
 end loop;
 insert into public.study_group_invites(group_id,inviter_id,code,expires_at,max_uses) values(p_group,auth.uid(),result,now()+make_interval(hours=>p_hours),p_max_uses);
 perform public.study_group_log(p_group,4);
 return result;
end $$;

create or replace function public.join_study_group_code(p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare row public.study_group_invites;
begin
 select * into row from public.study_group_invites where code=upper(btrim(p_code)) and invitee_id is null and status='pending' and expires_at>now() and uses<max_uses for update;
 if row.id is null or not public.community_pair_allowed(row.inviter_id,auth.uid()) then raise exception 'invite_unavailable'; end if;
 insert into public.study_group_members(group_id,user_id) values(row.group_id,auth.uid()) on conflict do nothing;
 update public.study_group_invites set uses=least(uses+1,max_uses),status=case when uses+1>=max_uses then 'accepted' else status end where id=row.id;
 perform public.study_group_log(row.group_id,5,auth.uid());return row.group_id;
end $$;

create or replace function public.revoke_study_group_code(p_group uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.study_group_can_manage(p_group) then raise exception 'group_unavailable'; end if;
 update public.study_group_invites set status='revoked' where group_id=p_group and invitee_id is null and status='pending';
 perform public.study_group_log(p_group,6);
end $$;

create or replace function public.update_study_group(p_group uuid,p_name text,p_subject text,p_description text,p_icon integer,p_color integer,p_admins_only boolean,p_members_invite boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.study_group_can_manage(p_group) or p_name is null or char_length(btrim(p_name)) not between 1 and 80 or p_subject is null or char_length(btrim(p_subject)) not between 1 and 80
  or p_description is null or char_length(p_description)>500 or p_icon not between 0 and 11 or p_color not between 0 and 7 or p_admins_only is null or p_members_invite is null then raise exception 'group_unavailable'; end if;
 update public.study_groups set name=btrim(p_name),subject=btrim(p_subject),description=btrim(p_description),avatar_icon=p_icon,avatar_color=p_color,admins_only_post=p_admins_only,members_can_invite=p_members_invite where id=p_group;
 perform public.study_group_log(p_group,7);
end $$;

create or replace function public.set_study_group_member_role(p_group uuid,p_user uuid,p_role text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if public.study_group_role(p_group)<>'owner' or p_role not in('admin','member') then raise exception 'group_unavailable'; end if;
 update public.study_group_members set role=p_role where group_id=p_group and user_id=p_user and role<>'owner';
 if not found then raise exception 'group_unavailable'; end if;perform public.study_group_log(p_group,8,p_user,jsonb_build_object('role',p_role));
end $$;

create or replace function public.remove_study_group_member(p_group uuid,p_user uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor text:=public.study_group_role(p_group);target text;
begin
 select role into target from public.study_group_members where group_id=p_group and user_id=p_user;
 if actor not in('owner','admin') or target is null or target='owner' or (actor='admin' and target='admin') then raise exception 'group_unavailable'; end if;
 delete from public.study_group_members where group_id=p_group and user_id=p_user;perform public.study_group_log(p_group,9,p_user);
end $$;

create or replace function public.set_study_group_preferences(p_group uuid,p_muted boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.study_group_members set notifications_muted=p_muted where group_id=p_group and user_id=auth.uid();if not found then raise exception 'group_unavailable';end if;
end $$;
create or replace function public.study_group_member_list(p_group uuid)
returns table(user_id uuid,display_name text,role text,notifications_muted boolean,joined_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_study_group_member(p_group) then raise exception 'group_unavailable';end if;
 return query select m.user_id,p.display_name,m.role,m.notifications_muted,m.joined_at
 from public.study_group_members m join public.profiles p on p.id=m.user_id where m.group_id=p_group
 order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,lower(p.display_name),m.user_id;
end $$;
create or replace function public.study_group_audit_list(p_group uuid)
returns table(id bigint,actor_name text,action smallint,target_id uuid,detail jsonb,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.study_group_can_manage(p_group) then raise exception 'group_unavailable';end if;
 return query select a.id,coalesce(p.display_name,'Удалённый пользователь'),a.action,a.target_id,a.detail,a.created_at
 from public.study_group_audit a left join public.profiles p on p.id=a.actor_id where a.group_id=p_group order by a.created_at desc,a.id desc limit 200;
end $$;
create or replace function public.leave_study_group(p_group uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if public.study_group_role(p_group)='owner' then raise exception 'owner_cannot_leave';end if;
 delete from public.study_group_members where group_id=p_group and user_id=auth.uid();if not found then raise exception 'group_unavailable';end if;
end $$;
create or replace function public.delete_study_group(p_group uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if public.study_group_role(p_group)<>'owner' then raise exception 'group_unavailable';end if;delete from public.study_groups where id=p_group;
end $$;

create or replace function public.send_study_group_message(p_group uuid,p_body text,p_client uuid,p_reply uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();mid uuid;existing public.study_group_messages;role text:=public.study_group_role(p_group);
begin
 if uid is null or role is null or ((select admins_only_post from public.study_groups where id=p_group) and role='member') then raise exception 'group_unavailable';end if;
 if p_client is null or p_body is null or char_length(btrim(p_body)) not between 1 and 2000 or (p_reply is not null and not exists(select 1 from public.study_group_messages where id=p_reply and group_id=p_group)) then raise exception 'invalid_message';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,732));select * into existing from public.study_group_messages where sender_id=uid and client_id=p_client;
 if existing.id is not null then return existing.id;end if;
 if(select count(*) from public.study_group_messages where sender_id=uid and created_at>now()-interval '1 minute')>=20 then raise exception 'rate_limit';end if;
 insert into public.study_group_messages(group_id,sender_id,body,client_id,reply_to) values(p_group,uid,btrim(p_body),p_client,p_reply) returning id into mid;return mid;
end $$;

create or replace function public.delete_study_group_message(p_message uuid)
returns void language plpgsql security definer set search_path='' as $$
declare gid uuid;sender uuid;
begin
 select group_id,sender_id into gid,sender from public.study_group_messages where id=p_message;
 if gid is null or (sender<>auth.uid() and not public.study_group_can_manage(gid)) then raise exception 'group_unavailable';end if;
 update public.study_group_messages set deleted_at=coalesce(deleted_at,now()) where id=p_message;perform public.study_group_log(gid,10,p_message);
end $$;
create or replace function public.toggle_study_group_reaction(p_message uuid,p_emoji integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare gid uuid;removed integer;
begin
 select group_id into gid from public.study_group_messages where id=p_message and deleted_at is null;
 if gid is null or not public.is_study_group_member(gid) or p_emoji not between 0 and 7 then raise exception 'group_unavailable';end if;
 delete from public.study_group_reactions where message_id=p_message and user_id=auth.uid() and emoji=p_emoji;get diagnostics removed=row_count;
 if removed=0 then insert into public.study_group_reactions(message_id,user_id,emoji) values(p_message,auth.uid(),p_emoji);return true;end if;return false;
end $$;
create or replace function public.pin_study_group_message(p_group uuid,p_message uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.study_group_can_manage(p_group) or (p_message is not null and not exists(select 1 from public.study_group_messages where id=p_message and group_id=p_group and deleted_at is null)) then raise exception 'group_unavailable';end if;
 update public.study_groups set pinned_message_id=p_message where id=p_group;perform public.study_group_log(p_group,11,p_message);
end $$;
create or replace function public.read_study_group(p_group uuid)
returns void language plpgsql security definer set search_path='' as $$
begin update public.study_group_members set last_read_at=clock_timestamp() where group_id=p_group and user_id=auth.uid();if not found then raise exception 'group_unavailable';end if;end $$;

create or replace function public.study_group_inbox()
returns table(id uuid,name text,subject text,description text,members_count bigint,owner boolean,last_at timestamptz,role text,avatar_icon smallint,avatar_color smallint,admins_only_post boolean,members_can_invite boolean,notifications_muted boolean,unread bigint,pinned_message_id uuid)
language sql stable security definer set search_path='' as $$
 select g.id,g.name,g.subject,g.description,(select count(*) from public.study_group_members x where x.group_id=g.id),m.role='owner',
 coalesce((select max(created_at) from public.study_group_messages x where x.group_id=g.id),g.created_at),m.role,g.avatar_icon,g.avatar_color,g.admins_only_post,g.members_can_invite,m.notifications_muted,
 (select count(*) from public.study_group_messages x where x.group_id=g.id and x.sender_id<>auth.uid() and x.deleted_at is null and x.created_at>coalesce(m.last_read_at,'-infinity')),
 g.pinned_message_id from public.study_groups g join public.study_group_members m on m.group_id=g.id and m.user_id=auth.uid() order by 7 desc,g.id desc limit 100;
$$;

create or replace function public.study_group_history(p_group uuid,p_before timestamptz default null,p_id uuid default null,p_query text default '')
returns table(id uuid,group_id uuid,sender_id uuid,author text,body text,client_id uuid,created_at timestamptz,deleted_at timestamptz,reply_to uuid,reactions jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_study_group_member(p_group) or char_length(coalesce(p_query,''))>100 then raise exception 'group_unavailable';end if;
 return query select m.id,m.group_id,m.sender_id,p.display_name,case when m.deleted_at is null then m.body else '' end,m.client_id,m.created_at,m.deleted_at,m.reply_to,
  coalesce((select jsonb_object_agg(r.emoji,r.total) from (select emoji,count(*) total from public.study_group_reactions where message_id=m.id group by emoji)r),'{}')
 from public.study_group_messages m join public.profiles p on p.id=m.sender_id
 where m.group_id=p_group and (p_before is null or (m.created_at,m.id)<(p_before,coalesce(p_id,'ffffffff-ffff-ffff-ffff-ffffffffffff')))
 and (m.sender_id=auth.uid() or public.community_pair_allowed(auth.uid(),m.sender_id))
 and (nullif(btrim(p_query),'') is null or (m.deleted_at is null and strpos(lower(m.body),lower(btrim(p_query)))>0))
 order by m.created_at desc,m.id desc limit 51;
end $$;

alter table public.community_reports drop constraint if exists community_reports_target_kind_check;
alter table public.community_reports add constraint community_reports_target_kind_check check(target_kind in('profile','message','homework','group','group_message'));
create or replace function public.community_report_target(p_kind text,p_target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select case p_kind
 when 'profile' then p_target<>auth.uid() and exists(select 1 from public.profiles where id=p_target)
 when 'message' then exists(select 1 from public.direct_messages m join public.dm_threads t on t.id=m.thread_id where m.id=p_target and m.sender_id<>auth.uid() and auth.uid() in(t.participant_a,t.participant_b))
 when 'homework' then exists(select 1 from public.class_homework h join public.profiles p on p.id=auth.uid() where h.id=p_target and h.deleted_at is null and (h.class_id=p.class_id or public.is_admin()))
 when 'group' then public.is_study_group_member(p_target)
 when 'group_message' then exists(select 1 from public.study_group_messages m where m.id=p_target and m.sender_id<>auth.uid() and public.is_study_group_member(m.group_id))
 else false end;
$$;

revoke all on function public.study_group_role(uuid),public.study_group_can_manage(uuid),public.study_group_can_invite(uuid),public.study_group_log(uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.study_group_role(uuid),public.study_group_can_manage(uuid),public.study_group_can_invite(uuid) to authenticated;
revoke all on function public.create_study_group(text,text,text,text[],integer,integer),public.study_group_friends(uuid),public.study_group_people(uuid,text),public.invite_study_group_members(uuid,uuid[]),public.study_group_invitation_inbox(),public.respond_study_group_invite(uuid,boolean),public.create_study_group_code(uuid,integer,integer),public.join_study_group_code(text),public.revoke_study_group_code(uuid),public.update_study_group(uuid,text,text,text,integer,integer,boolean,boolean),public.set_study_group_member_role(uuid,uuid,text),public.remove_study_group_member(uuid,uuid),public.set_study_group_preferences(uuid,boolean),public.study_group_member_list(uuid),public.study_group_audit_list(uuid),public.leave_study_group(uuid),public.delete_study_group(uuid),public.send_study_group_message(uuid,text,uuid,uuid),public.delete_study_group_message(uuid),public.toggle_study_group_reaction(uuid,integer),public.pin_study_group_message(uuid,uuid),public.read_study_group(uuid),public.study_group_inbox(),public.study_group_history(uuid,timestamptz,uuid,text) from public,anon;
grant execute on function public.create_study_group(text,text,text,text[],integer,integer),public.study_group_friends(uuid),public.study_group_people(uuid,text),public.invite_study_group_members(uuid,uuid[]),public.study_group_invitation_inbox(),public.respond_study_group_invite(uuid,boolean),public.create_study_group_code(uuid,integer,integer),public.join_study_group_code(text),public.revoke_study_group_code(uuid),public.update_study_group(uuid,text,text,text,integer,integer,boolean,boolean),public.set_study_group_member_role(uuid,uuid,text),public.remove_study_group_member(uuid,uuid),public.set_study_group_preferences(uuid,boolean),public.study_group_member_list(uuid),public.study_group_audit_list(uuid),public.leave_study_group(uuid),public.delete_study_group(uuid),public.send_study_group_message(uuid,text,uuid,uuid),public.delete_study_group_message(uuid),public.toggle_study_group_reaction(uuid,integer),public.pin_study_group_message(uuid,uuid),public.read_study_group(uuid),public.study_group_inbox(),public.study_group_history(uuid,timestamptz,uuid,text) to authenticated;

commit;
