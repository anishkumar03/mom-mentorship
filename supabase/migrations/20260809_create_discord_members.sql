-- Discord bot member tracking. One row per Discord user, upserted on join so a rejoin
-- updates the existing row instead of throwing a unique violation on discord_user_id.
-- On leave, left_at is set rather than the row deleted, so rejoins under a new display
-- name stay traceable back to the same account.
CREATE TABLE IF NOT EXISTS public.discord_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id text NOT NULL UNIQUE,
  discord_username text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  dm_delivered boolean NOT NULL DEFAULT false,
  left_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_discord_members_discord_user_id ON public.discord_members (discord_user_id);

ALTER TABLE public.discord_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for discord_members" ON public.discord_members;
CREATE POLICY "Allow all for discord_members" ON public.discord_members FOR ALL USING (true) WITH CHECK (true);
