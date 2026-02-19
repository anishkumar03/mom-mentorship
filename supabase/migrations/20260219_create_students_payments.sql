create extension if not exists "pgcrypto";

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  program text,
  total_fee numeric not null,
  due_date timestamptz null,
  reminder_at timestamptz null,
  notes text null,
  created_at timestamptz default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  amount numeric not null,
  paid_at timestamptz default now(),
  method text null,
  note text null,
  created_at timestamptz default now()
);
