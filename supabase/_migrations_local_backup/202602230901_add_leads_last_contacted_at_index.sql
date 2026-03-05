alter table public.leads
  add column if not exists last_contacted_at timestamptz;

create index if not exists leads_last_contacted_at_idx
  on public.leads (last_contacted_at desc);
