-- Tracks whether the automated welcome email (sent on new lead creation) went out,
-- so failures/duplicates are visible in the Leads tab instead of silently disappearing.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS welcome_email_status text NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS welcome_email_error text NULL;

CREATE INDEX IF NOT EXISTS idx_leads_welcome_email_status ON public.leads (welcome_email_status);
