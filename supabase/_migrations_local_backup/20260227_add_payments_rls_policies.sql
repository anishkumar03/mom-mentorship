alter table public.payments enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'payments_select_anon'
  ) then
    create policy "payments_select_anon"
      on public.payments
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'payments'
      and policyname = 'payments_insert_anon'
  ) then
    create policy "payments_insert_anon"
      on public.payments
      for insert
      to anon, authenticated
      with check (true);
  end if;
end
$$;
