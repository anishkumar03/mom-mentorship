-- Add total_fee column to leads for confirmed leads payment tracking
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS total_fee numeric NULL DEFAULT 0;

-- Create lead_payments table for tracking partial payments on confirmed leads
CREATE TABLE IF NOT EXISTS public.lead_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  paid_at timestamptz DEFAULT now(),
  method text NULL,
  note text NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_payments_lead_id ON public.lead_payments (lead_id);

-- RLS policies for lead_payments
ALTER TABLE public.lead_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to lead_payments" ON public.lead_payments FOR ALL USING (true) WITH CHECK (true);
