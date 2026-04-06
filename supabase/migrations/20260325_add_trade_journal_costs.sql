alter table public.trade_journal
  add column if not exists commissions numeric null,
  add column if not exists fees numeric null;
