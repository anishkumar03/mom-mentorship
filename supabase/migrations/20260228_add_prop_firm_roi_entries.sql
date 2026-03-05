create table if not exists public.prop_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text null,
  account_size numeric null,
  profit_split numeric null,
  created_at timestamptz default now()
);

create unique index if not exists prop_firms_name_key on public.prop_firms (name);

create table if not exists public.roi_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.prop_firms(id) on delete cascade,
  entry_date date null,
  payout numeric not null default 0,
  spend numeric not null default 0,
  notes text null,
  created_at timestamptz default now()
);

create index if not exists roi_entries_firm_id_idx on public.roi_entries (firm_id);
create index if not exists roi_entries_entry_date_idx on public.roi_entries (entry_date);

alter table public.prop_firms enable row level security;
alter table public.roi_entries enable row level security;

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
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_entries' and policyname = 'roi_entries_select_anon'
  ) then
    create policy "roi_entries_select_anon"
      on public.roi_entries
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_entries' and policyname = 'roi_entries_insert_anon'
  ) then
    create policy "roi_entries_insert_anon"
      on public.roi_entries
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_entries' and policyname = 'roi_entries_update_anon'
  ) then
    create policy "roi_entries_update_anon"
      on public.roi_entries
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_entries' and policyname = 'roi_entries_delete_anon'
  ) then
    create policy "roi_entries_delete_anon"
      on public.roi_entries
      for delete
      to anon, authenticated
      using (true);
  end if;
end
$$;
