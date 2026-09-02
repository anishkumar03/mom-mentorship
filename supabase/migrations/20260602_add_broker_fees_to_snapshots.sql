-- Add broker fees and gross P&L tracking to prop account snapshots
ALTER TABLE IF EXISTS public.prop_account_snapshots
  ADD COLUMN IF NOT EXISTS gross_pnl NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS broker_fees NUMERIC NULL;

-- Add comment explaining the fields
COMMENT ON COLUMN public.prop_account_snapshots.gross_pnl IS 'Trading profit before broker fees/commissions';
COMMENT ON COLUMN public.prop_account_snapshots.broker_fees IS 'Total broker fees, commissions, or charges';
