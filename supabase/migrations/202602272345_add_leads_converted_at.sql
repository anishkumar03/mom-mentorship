alter table public.leads
add column if not exists converted_at timestamptz;

create index if not exists leads_converted_at_idx on public.leads (converted_at);
