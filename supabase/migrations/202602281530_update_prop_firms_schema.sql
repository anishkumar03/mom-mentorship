create table if not exists public.prop_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text null,
  account_size numeric null,
  profit_split_pct numeric null,
  created_at timestamptz default now()
);

alter table public.prop_firms
  add column if not exists platform text null,
  add column if not exists account_size numeric null,
  add column if not exists profit_split_pct numeric null,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'prop_firms' and column_name = 'profit_split'
  ) then
    update public.prop_firms
      set profit_split_pct = profit_split
      where profit_split_pct is null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prop_firms_profit_split_pct_check'
  ) then
    alter table public.prop_firms
      add constraint prop_firms_profit_split_pct_check
      check (profit_split_pct is null or (profit_split_pct >= 0 and profit_split_pct <= 100));
  end if;
end
$$;

alter table public.prop_firms enable row level security;

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
end
$$;
