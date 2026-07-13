-- Links a CRM batch label (leads.batch) to the Session Auto-Dispatch group
-- that was auto-created/reused for it, so newly assigned students can be
-- synced into that dispatch group's student list.
CREATE TABLE IF NOT EXISTS public.crm_batch_dispatch_links (
  batch_label text PRIMARY KEY,
  batch_group_id uuid NOT NULL REFERENCES public.batch_groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_batch_dispatch_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for crm_batch_dispatch_links" ON public.crm_batch_dispatch_links FOR ALL USING (true) WITH CHECK (true);
