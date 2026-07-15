-- dispatch_logs previously only recorded successful/partial sends. These columns let a
-- fully-failed dispatch (e.g. zero resolvable recipients) also land a row here instead of
-- only being visible via pending_dispatches.error, and link back to the originating dispatch.
ALTER TABLE IF EXISTS public.dispatch_logs ADD COLUMN IF NOT EXISTS error text NULL;
ALTER TABLE IF EXISTS public.dispatch_logs ADD COLUMN IF NOT EXISTS pending_dispatch_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_dispatch_logs_pending_dispatch_id ON public.dispatch_logs (pending_dispatch_id);
