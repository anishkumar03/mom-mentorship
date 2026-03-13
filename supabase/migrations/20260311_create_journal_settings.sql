-- Key-value store for journal settings (trade plan, etc.)
CREATE TABLE IF NOT EXISTS journal_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow public access (matches existing RLS pattern)
ALTER TABLE journal_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to journal_settings" ON journal_settings FOR ALL USING (true) WITH CHECK (true);
