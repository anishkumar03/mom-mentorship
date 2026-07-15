-- Needed for duplicate-dispatch protection (matching a live send against prior successful
-- sends for the same batch+date) and for the dispatch-health-check "stale batch" scan.
ALTER TABLE IF EXISTS public.dispatch_logs ADD COLUMN IF NOT EXISTS batch_name text NULL;
ALTER TABLE IF EXISTS public.dispatch_logs ADD COLUMN IF NOT EXISTS meeting_date date NULL;

CREATE INDEX IF NOT EXISTS idx_dispatch_logs_batch_name_meeting_date ON public.dispatch_logs (batch_name, meeting_date);

-- Dedup table for dispatch-health-check so it doesn't re-alert on Telegram every time it runs
-- for the same unmatched recording / stale batch condition.
CREATE TABLE IF NOT EXISTS public.dispatch_health_alerts (
  alert_key text PRIMARY KEY,
  alerted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dispatch_health_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for dispatch_health_alerts" ON public.dispatch_health_alerts FOR ALL USING (true) WITH CHECK (true);
