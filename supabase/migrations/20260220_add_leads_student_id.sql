alter table public.leads
  add column if not exists student_id uuid;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_student_id_fkey'
  ) then
    alter table public.leads
      add constraint leads_student_id_fkey
      foreign key (student_id)
      references public.students(id)
      on delete set null;
  end if;
end $$;
