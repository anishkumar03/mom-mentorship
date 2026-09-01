-- Prop firm trading accounts
CREATE TABLE IF NOT EXISTS prop_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL,
  firm TEXT,
  account_size NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance snapshots (history)
CREATE TABLE IF NOT EXISTS prop_account_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES prop_accounts(id) ON DELETE CASCADE,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  balance NUMERIC DEFAULT 0,
  pnl NUMERIC DEFAULT 0,
  drawdown NUMERIC DEFAULT 0,
  max_drawdown NUMERIC DEFAULT 0,
  profit_factor NUMERIC DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  winning_trades INTEGER DEFAULT 0,
  losing_trades INTEGER DEFAULT 0,
  avg_win NUMERIC DEFAULT 0,
  avg_loss NUMERIC DEFAULT 0,
  largest_win NUMERIC DEFAULT 0,
  largest_loss NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE prop_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_account_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for prop_accounts" ON prop_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for prop_account_snapshots" ON prop_account_snapshots FOR ALL USING (true) WITH CHECK (true);
