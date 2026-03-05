alter table public.students
  add column if not exists phone text,
  add column if not exists due_date date,
  add column if not exists reminder_at timestamptz;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'students_has_identity_chk'
  ) then
    alter table public.students
      add constraint students_has_identity_chk
      check (
        full_name is not null
        or name is not null
        or email is not null
      );
  end if;
end $$;
