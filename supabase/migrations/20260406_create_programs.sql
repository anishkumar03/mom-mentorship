-- Programs table: dynamic program management
CREATE TABLE IF NOT EXISTS programs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed with existing programs
INSERT INTO programs (name) VALUES ('April Group Mentorship'), ('Private Coaching')
ON CONFLICT (name) DO NOTHING;

-- RLS
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for programs" ON programs FOR ALL USING (true) WITH CHECK (true);
