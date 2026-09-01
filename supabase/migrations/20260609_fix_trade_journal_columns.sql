-- Ensure trade_journal table has all required columns
ALTER TABLE IF EXISTS public.trade_journal
  ADD COLUMN IF NOT EXISTS commissions NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS fees NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.roi_firms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.roi_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS direction TEXT NULL,
  ADD COLUMN IF NOT EXISTS contracts INT NULL,
  ADD COLUMN IF NOT EXISTS exit_price NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS screenshot_path TEXT NULL,
  ADD COLUMN IF NOT EXISTS symbol TEXT NULL,
  ADD COLUMN IF NOT EXISTS entry_price NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS trade_date DATE NULL,
  ADD COLUMN IF NOT EXISTS setup_screenshot_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS setup_screenshot_path TEXT NULL;

-- Ensure RLS policies exist for trade_journal (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trade_journal' AND policyname = 'trade_journal_select_all'
  ) THEN
    CREATE POLICY "trade_journal_select_all"
      ON public.trade_journal
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trade_journal' AND policyname = 'trade_journal_insert_all'
  ) THEN
    CREATE POLICY "trade_journal_insert_all"
      ON public.trade_journal
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trade_journal' AND policyname = 'trade_journal_update_all'
  ) THEN
    CREATE POLICY "trade_journal_update_all"
      ON public.trade_journal
      FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trade_journal' AND policyname = 'trade_journal_delete_all'
  ) THEN
    CREATE POLICY "trade_journal_delete_all"
      ON public.trade_journal
      FOR DELETE
      TO anon, authenticated
      USING (true);
  END IF;
END
$$;
