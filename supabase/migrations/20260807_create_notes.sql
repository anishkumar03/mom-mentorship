-- Freeform notes, optionally linked to a student. General/mentorship notes leave
-- student_id null; per-student notes set it and show up on that student.
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NULL REFERENCES public.students(id) ON DELETE SET NULL,
  title text NULL,
  content_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_student_id ON public.notes (student_id);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for notes" ON public.notes;
CREATE POLICY "Allow all for notes" ON public.notes FOR ALL USING (true) WITH CHECK (true);
