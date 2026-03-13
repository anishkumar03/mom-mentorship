-- Add batch column to leads table for grouping confirmed leads into batches
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS batch text NULL;
CREATE INDEX IF NOT EXISTS idx_leads_batch ON public.leads (batch);
