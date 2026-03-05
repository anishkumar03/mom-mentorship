alter table public.leads
add column if not exists last_contacted_at timestamptz;

create index if not exists leads_last_contacted_at_idx on public.leads (last_contacted_at);

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'leads'
      and policyname = 'leads_update_last_contacted_anon'
  ) then
    create policy "leads_update_last_contacted_anon"
      on public.leads
      for update
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end
$$;
