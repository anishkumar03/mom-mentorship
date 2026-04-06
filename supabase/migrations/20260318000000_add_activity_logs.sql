create table if not exists activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  user_email text,
  module text not null,
  action text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists activity_logs_user_id_idx on activity_logs(user_id);
create index if not exists activity_logs_created_at_idx on activity_logs(created_at);
