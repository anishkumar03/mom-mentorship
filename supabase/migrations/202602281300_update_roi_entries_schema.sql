create table if not exists public.prop_firms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  platform text null,
  account_size numeric null,
  profit_split numeric null,
  created_at timestamptz default now()
);

create table if not exists public.roi_entries (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid references public.prop_firms(id) on delete cascade,
  entry_date date null,
  payout numeric not null default 0,
  spend numeric not null default 0,
  notes text null,
  created_at timestamptz default now()
);

alter table public.roi_entries
  add column if not exists entry_type text,
  add column if not exists amount numeric,
  add column if not exists category text,
  add column if not exists description text;

update public.roi_entries
set entry_type = case
  when coalesce(payout, 0) > 0 then 'payout'
  when coalesce(spend, 0) > 0 then 'expense'
  else 'expense'
end
where entry_type is null;

update public.roi_entries
set amount = case
  when entry_type = 'payout' then coalesce(payout, 0)
  when entry_type = 'expense' then coalesce(spend, 0)
  else coalesce(spend, 0)
end
where amount is null;

update public.roi_entries
set description = 'Imported'
where description is null or description = '';

update public.roi_entries
set entry_date = current_date
where entry_date is null;

alter table public.roi_entries
  alter column entry_date set default current_date,
  alter column entry_date set not null,
  alter column entry_type set not null,
  alter column amount set not null,
  alter column description set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'roi_entries_entry_type_check'
  ) then
    alter table public.roi_entries
      add constraint roi_entries_entry_type_check
      check (entry_type in ('expense','payout'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'roi_entries_amount_check'
  ) then
    alter table public.roi_entries
      add constraint roi_entries_amount_check
      check (amount >= 0);
  end if;
end
$$;
