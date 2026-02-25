create extension if not exists "pgcrypto";

create table if not exists public.trade_journal (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  trade_date date not null,
  symbol text null,
  setup text null,
  emotion text null,
  entry_price numeric null,
  entry_time timestamptz null,
  exit_time timestamptz null,
  pnl numeric null,
  notes text null,
  screenshot_url text null,
  archived boolean default false
);

alter table public.trade_journal enable row level security;

create policy "trade_journal_anon_select"
  on public.trade_journal
  for select
  to anon
  using (true);

create policy "trade_journal_anon_insert"
  on public.trade_journal
  for insert
  to anon
  with check (true);

create policy "trade_journal_anon_update"
  on public.trade_journal
  for update
  to anon
  using (true)
  with check (true);

create policy "trade_journal_anon_delete"
  on public.trade_journal
  for delete
  to anon
  using (true);

insert into storage.buckets (id, name, public)
values ('journal_screenshots', 'journal_screenshots', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy "journal_screenshots_public_read"
  on storage.objects
  for select
  to anon
  using (bucket_id = 'journal_screenshots');

create policy "journal_screenshots_public_insert"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'journal_screenshots');
