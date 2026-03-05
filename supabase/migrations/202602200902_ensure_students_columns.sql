alter table public.students
  add column if not exists full_name text,
  add column if not exists due_date timestamptz null,
  add column if not exists reminder_at timestamptz null;
