create table if not exists public.prop_accounts (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.prop_firms(id) on delete cascade,
  name text not null,
  account_size text null,
  account_type text null,
  created_at timestamptz default now(),
  unique (firm_id, name)
);

create index if not exists prop_accounts_firm_id_idx on public.prop_accounts (firm_id);

alter table public.prop_firms
  add column if not exists firm_type text not null default 'prop';

update public.prop_firms
  set firm_type = 'prop'
  where firm_type is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'prop_firms_firm_type_check'
  ) then
    alter table public.prop_firms
      add constraint prop_firms_firm_type_check
      check (firm_type in ('prop', 'personal'));
  end if;
end
$$;

alter table public.trade_journal
  drop constraint if exists trade_journal_firm_id_fkey,
  drop constraint if exists trade_journal_account_id_fkey;

alter table public.trade_journal
  add constraint trade_journal_firm_id_fkey
  foreign key (firm_id) references public.prop_firms(id) on delete set null,
  add constraint trade_journal_account_id_fkey
  foreign key (account_id) references public.prop_accounts(id) on delete set null;

alter table public.prop_firms enable row level security;
alter table public.prop_accounts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firms' and policyname = 'prop_firms_select_all'
  ) then
    create policy "prop_firms_select_all"
      on public.prop_firms
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firms' and policyname = 'prop_firms_insert_all'
  ) then
    create policy "prop_firms_insert_all"
      on public.prop_firms
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firms' and policyname = 'prop_firms_update_all'
  ) then
    create policy "prop_firms_update_all"
      on public.prop_firms
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_firms' and policyname = 'prop_firms_delete_all'
  ) then
    create policy "prop_firms_delete_all"
      on public.prop_firms
      for delete
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_accounts' and policyname = 'prop_accounts_select_all'
  ) then
    create policy "prop_accounts_select_all"
      on public.prop_accounts
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_accounts' and policyname = 'prop_accounts_insert_all'
  ) then
    create policy "prop_accounts_insert_all"
      on public.prop_accounts
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_accounts' and policyname = 'prop_accounts_update_all'
  ) then
    create policy "prop_accounts_update_all"
      on public.prop_accounts
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'prop_accounts' and policyname = 'prop_accounts_delete_all'
  ) then
    create policy "prop_accounts_delete_all"
      on public.prop_accounts
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
  from public.prop_firms
  where firm_type = 'personal'
  order by created_at
  limit 1;

  if personal_id is null then
    insert into public.prop_firms (name, platform, account_size, profit_split_pct, firm_type)
    values ('Personal', 'Personal', null, null, 'personal')
    returning id into personal_id;
  end if;

  if not exists (
    select 1 from public.prop_accounts where firm_id = personal_id and name = 'Main Personal Account'
  ) then
    insert into public.prop_accounts (firm_id, name, account_type)
    values (personal_id, 'Main Personal Account', 'personal');
  end if;
end
$$;
