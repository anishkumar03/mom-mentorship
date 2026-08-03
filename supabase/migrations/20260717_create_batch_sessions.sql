-- Per-session schedule for group email_batches, so a skipped week (holiday, travel) can push
-- later sessions out without touching session_number, and the welcome email can read real
-- dates instead of assuming 7 consecutive weeks from start_date.
CREATE TABLE IF NOT EXISTS public.batch_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.email_batches(id) ON DELETE CASCADE,
  session_number int NOT NULL CHECK (session_number BETWEEN 1 AND 7),
  session_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'skipped', 'completed')),
  topic text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_batch_sessions_batch_id ON public.batch_sessions (batch_id);

ALTER TABLE public.batch_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for batch_sessions" ON public.batch_sessions;
CREATE POLICY "Allow all for batch_sessions" ON public.batch_sessions FOR ALL USING (true) WITH CHECK (true);

-- Backfill: 7 weekly sessions for every existing group batch that has a start_date and doesn't
-- already have batch_sessions rows. Safe to re-run — skips any batch already backfilled.
INSERT INTO public.batch_sessions (batch_id, session_number, session_date, status)
SELECT
  b.id,
  gs.session_number,
  (b.start_date + ((gs.session_number - 1) * 7))::date,
  'scheduled'
FROM public.email_batches b
CROSS JOIN generate_series(1, 7) AS gs(session_number)
WHERE b.type = 'group'
  AND b.start_date IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.batch_sessions bs WHERE bs.batch_id = b.id
  );
