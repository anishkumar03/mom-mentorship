create extension if not exists "pgcrypto";

create table if not exists public.roi_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text null,
  account_size numeric null,
  profit_split numeric null,
  firm_type text not null default 'prop',
  created_at timestamptz default now()
);

alter table public.roi_firms
  add column if not exists platform text null,
  add column if not exists account_size numeric null,
  add column if not exists profit_split numeric null,
  add column if not exists firm_type text not null default 'prop',
  add column if not exists created_at timestamptz default now();

update public.roi_firms
  set firm_type = 'prop'
  where firm_type is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'roi_firms_firm_type_check'
  ) then
    alter table public.roi_firms
      add constraint roi_firms_firm_type_check
      check (firm_type in ('prop', 'personal'));
  end if;
end
$$;

create table if not exists public.roi_accounts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.roi_firms(id) on delete cascade,
  name text not null,
  account_size text null,
  account_type text null,
  created_at timestamptz default now(),
  unique (firm_id, name)
);

create index if not exists roi_accounts_firm_id_idx on public.roi_accounts (firm_id);

alter table public.trade_journal
  add column if not exists firm_id uuid references public.roi_firms(id) on delete set null,
  add column if not exists account_id uuid references public.roi_accounts(id) on delete set null,
  add column if not exists direction text null,
  add column if not exists contracts int null,
  add column if not exists exit_price numeric null,
  add column if not exists screenshot_path text null,
  add column if not exists symbol text null,
  add column if not exists entry_price numeric null,
  add column if not exists trade_date date null;

alter table public.trade_journal
  alter column trade_date drop not null;

update public.trade_journal
  set trade_date = entry_time::date
  where trade_date is null and entry_time is not null;

alter table public.roi_firms enable row level security;
alter table public.roi_accounts enable row level security;
alter table public.trade_journal enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_firms' and policyname = 'roi_firms_select_all'
  ) then
    create policy "roi_firms_select_all"
      on public.roi_firms
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_firms' and policyname = 'roi_firms_insert_all'
  ) then
    create policy "roi_firms_insert_all"
      on public.roi_firms
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_firms' and policyname = 'roi_firms_update_all'
  ) then
    create policy "roi_firms_update_all"
      on public.roi_firms
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_firms' and policyname = 'roi_firms_delete_all'
  ) then
    create policy "roi_firms_delete_all"
      on public.roi_firms
      for delete
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_accounts' and policyname = 'roi_accounts_select_all'
  ) then
    create policy "roi_accounts_select_all"
      on public.roi_accounts
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_accounts' and policyname = 'roi_accounts_insert_all'
  ) then
    create policy "roi_accounts_insert_all"
      on public.roi_accounts
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_accounts' and policyname = 'roi_accounts_update_all'
  ) then
    create policy "roi_accounts_update_all"
      on public.roi_accounts
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'roi_accounts' and policyname = 'roi_accounts_delete_all'
  ) then
    create policy "roi_accounts_delete_all"
      on public.roi_accounts
      for delete
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trade_journal' and policyname = 'trade_journal_select_all'
  ) then
    create policy "trade_journal_select_all"
      on public.trade_journal
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trade_journal' and policyname = 'trade_journal_insert_all'
  ) then
    create policy "trade_journal_insert_all"
      on public.trade_journal
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trade_journal' and policyname = 'trade_journal_update_all'
  ) then
    create policy "trade_journal_update_all"
      on public.trade_journal
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'trade_journal' and policyname = 'trade_journal_delete_all'
  ) then
    create policy "trade_journal_delete_all"
      on public.trade_journal
      for delete
      to anon, authenticated
      using (true);
  end if;
end
$$;

do $$
declare
  personal_id uuid;
begin
  select id into personal_id
  from public.roi_firms
  where firm_type = 'personal'
  order by created_at
  limit 1;

  if personal_id is null then
    insert into public.roi_firms (name, platform, account_size, profit_split, firm_type)
    values ('Personal', 'Personal', null, null, 'personal')
    returning id into personal_id;
  end if;

  if not exists (
    select 1 from public.roi_accounts where firm_id = personal_id and name = 'Main Personal Account'
  ) then
    insert into public.roi_accounts (firm_id, name, account_type)
    values (personal_id, 'Main Personal Account', 'personal');
  end if;
end
$$;
