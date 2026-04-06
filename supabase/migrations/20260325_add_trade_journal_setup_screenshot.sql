alter table public.trade_journal
  add column if not exists setup_screenshot_path text null,
  add column if not exists setup_screenshot_url text null;
