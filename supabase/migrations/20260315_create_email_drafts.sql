-- Email drafts table for CRM email functionality
create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  to_email text not null,
  to_name text,
  subject text not null default '',
  body text not null default '',
  status text not null default 'draft', -- 'draft', 'sent', 'failed'
  sent_at timestamptz,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS policies
alter table public.email_drafts enable row level security;

create policy "email_drafts_select" on public.email_drafts
  for select to anon, authenticated using (true);
create policy "email_drafts_insert" on public.email_drafts
  for insert to anon, authenticated with check (true);
create policy "email_drafts_update" on public.email_drafts
  for update to anon, authenticated using (true) with check (true);
create policy "email_drafts_delete" on public.email_drafts
  for delete to anon, authenticated using (true);
