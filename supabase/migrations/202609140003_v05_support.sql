begin;
create table public.support_tickets (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 category text not null check(category in ('platform','schedule','library','account','data','other')),
 title text not null check(length(btrim(title)) between 1 and 120),
 description text not null check(length(btrim(description)) between 1 and 5000),
 status text not null default 'open' check(status in ('open','in_progress','resolved','closed')),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 last_user_message_at timestamptz not null default clock_timestamp(),
 last_admin_message_at timestamptz,
 needs_admin_reply boolean not null default true
);
create index support_owner_created on public.support_tickets(owner_id,created_at desc);
create index support_status_created on public.support_tickets(status,created_at desc);
create table public.support_messages (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid references public.profiles(id) on delete set null,
 author_role text not null check(author_role in ('student','admin')),
 body text not null check(length(btrim(body)) between 1 and 5000),
 created_at timestamptz not null default clock_timestamp()
);
create index support_messages_ticket on public.support_messages(ticket_id,created_at);
create index support_messages_author on public.support_messages(author_id,created_at desc);
create table public.support_status_events (
 id uuid primary key default gen_random_uuid(),
 ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,
 previous_status text not null, status text not null,
 created_at timestamptz not null default clock_timestamp()
);
create index support_status_ticket on public.support_status_events(ticket_id,created_at);
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_status_events enable row level security;
revoke all on public.support_tickets,public.support_messages,public.support_status_events from public,anon,authenticated;
grant select on public.support_tickets,public.support_messages,public.support_status_events to authenticated;
create policy "Owner and existing admins read tickets" on public.support_tickets for select to authenticated
using(owner_id=auth.uid() or public.is_admin());
create policy "Read own or admin ticket replies" on public.support_messages for select to authenticated
using(exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.owner_id=auth.uid() or public.is_admin())));
create policy "Read own or admin status history" on public.support_status_events for select to authenticated
using(exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.owner_id=auth.uid() or public.is_admin())));

-- Definer functions expose only bounded, authenticated operations; clients cannot
-- forge owners, authors, roles, status changes, timestamps or notification flags.
create function public.create_support_ticket(p_category text,p_title text,p_description text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(506,pg_catalog.hashtext(auth.uid()::text));
 if exists(select 1 from public.support_tickets where owner_id=auth.uid() and created_at>clock_timestamp()-interval '60 seconds')
 or (select count(*) from public.support_tickets where owner_id=auth.uid() and created_at>clock_timestamp()-interval '1 day')>=20 then
  raise exception 'Ticket rate limit' using errcode='23514';
 end if;
 insert into public.support_tickets(owner_id,category,title,description)
 values(auth.uid(),p_category,btrim(p_title),btrim(p_description)) returning id into result;
 return result;
end;
$$;
create function public.reply_support_ticket(p_ticket uuid,p_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare ticket public.support_tickets; result uuid; admin boolean; stamp timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(506,pg_catalog.hashtext(auth.uid()::text));
 admin:=public.is_admin();
 select * into ticket from public.support_tickets where id=p_ticket for update;
 if ticket.id is null or (not admin and (ticket.owner_id<>auth.uid() or ticket.status not in ('open','in_progress'))) then
  raise exception 'Ticket unavailable' using errcode='42501';
 end if;
 if exists(select 1 from public.support_messages where author_id=auth.uid() and created_at>clock_timestamp()-interval '5 seconds')
 or (select count(*) from public.support_messages where author_id=auth.uid() and created_at>clock_timestamp()-interval '1 hour')>=60 then
  raise exception 'Reply rate limit' using errcode='23514';
 end if;
 stamp:=clock_timestamp();
 insert into public.support_messages(ticket_id,author_id,author_role,body,created_at)
 values(p_ticket,auth.uid(),case when admin then 'admin' else 'student' end,btrim(p_body),stamp) returning id into result;
 update public.support_tickets set updated_at=stamp,needs_admin_reply=not admin,
 last_user_message_at=case when admin then last_user_message_at else stamp end,
 last_admin_message_at=case when admin then stamp else last_admin_message_at end where id=p_ticket;
 return result;
end;
$$;
create function public.set_support_status(p_ticket uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare previous text; stamp timestamptz;
begin
 if not public.is_admin() then raise exception 'Admin required' using errcode='42501'; end if;
 if p_status is null or p_status not in ('open','in_progress','resolved','closed') then raise exception 'Invalid status' using errcode='23514'; end if;
 select status into previous from public.support_tickets where id=p_ticket for update;
 if previous is null then raise exception 'Ticket unavailable' using errcode='42501'; end if;
 if previous=p_status then return; end if;
 stamp:=clock_timestamp();
 update public.support_tickets set status=p_status,updated_at=stamp where id=p_ticket;
 insert into public.support_status_events(ticket_id,actor_id,previous_status,status,created_at) values(p_ticket,auth.uid(),previous,p_status,stamp);
end;
$$;
revoke all on function public.create_support_ticket(text,text,text),public.reply_support_ticket(uuid,text),public.set_support_status(uuid,text) from public,anon;
grant execute on function public.create_support_ticket(text,text,text),public.reply_support_ticket(uuid,text),public.set_support_status(uuid,text) to authenticated;
commit;
