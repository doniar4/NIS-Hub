begin;
create table public.non_school_days (
  id uuid primary key default gen_random_uuid(),
  start_date date not null, end_date date not null,
  type text not null check (type in ('holiday','vacation','cancelled','other')),
  label text not null check (length(btrim(label)) between 1 and 160),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date and end_date - start_date <= 366)
);
alter table public.non_school_days enable row level security;
revoke all on public.non_school_days from public, anon, authenticated;
grant select, insert, delete on public.non_school_days to authenticated;
create policy "Read school calendar" on public.non_school_days for select to authenticated using (true);
create policy "Admin adds school closure" on public.non_school_days for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());
create policy "Admin removes school closure" on public.non_school_days for delete to authenticated using (public.is_admin());
commit;
