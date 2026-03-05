alter table public.students
  add column if not exists due_date timestamptz null,
  add column if not exists reminder_at timestamptz null,
  add column if not exists paid_in_full boolean not null default false;
