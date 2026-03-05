create table if not exists public.prop_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text null,
  account_size numeric null,
  profit_split numeric null,
  created_at timestamptz default now()
);

create unique index if not exists prop_firms_name_key on public.prop_firms (name);

create table if not exists public.prop_firm_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.prop_firms(id) on delete cascade,
  entry_date date null,
  pnl numeric not null default 0,
  fees numeric not null default 0,
  notes text null,
  created_at timestamptz default now()
);

create index if not exists prop_firm_entries_firm_id_idx on public.prop_firm_entries (firm_id);
create index if not exists prop_firm_entries_entry_date_idx on public.prop_firm_entries (entry_date);

alter table public.prop_firms enable row level security;
alter table public.prop_firm_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firms' and policyname = 'prop_firms_select_anon'
  ) then
    create policy "prop_firms_select_anon"
      on public.prop_firms
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firms' and policyname = 'prop_firms_insert_anon'
  ) then
    create policy "prop_firms_insert_anon"
      on public.prop_firms
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firms' and policyname = 'prop_firms_update_anon'
  ) then
    create policy "prop_firms_update_anon"
      on public.prop_firms
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firms' and policyname = 'prop_firms_delete_anon'
  ) then
    create policy "prop_firms_delete_anon"
      on public.prop_firms
      for delete
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firm_entries' and policyname = 'prop_firm_entries_select_anon'
  ) then
    create policy "prop_firm_entries_select_anon"
      on public.prop_firm_entries
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firm_entries' and policyname = 'prop_firm_entries_insert_anon'
  ) then
    create policy "prop_firm_entries_insert_anon"
      on public.prop_firm_entries
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firm_entries' and policyname = 'prop_firm_entries_update_anon'
  ) then
    create policy "prop_firm_entries_update_anon"
      on public.prop_firm_entries
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firm_entries' and policyname = 'prop_firm_entries_delete_anon'
  ) then
    create policy "prop_firm_entries_delete_anon"
      on public.prop_firm_entries
      for delete
      to anon, authenticated
      using (true);
  end if;
end
$$;
