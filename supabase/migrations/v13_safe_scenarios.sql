-- ═══════════════════════════════════════════════════════════════
-- v13_safe_scenarios.sql
-- Chunk 9: SAFE/Note calculator — save & revisit scenarios per user.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.safe_scenarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  instrument      TEXT NOT NULL CHECK (instrument IN ('safe_post', 'safe_pre', 'note')),
  -- Raw inputs stored as JSON so we can reload the exact calculation
  inputs          JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safe_scenarios_user_idx ON public.safe_scenarios (user_id, created_at DESC);

-- RLS: users can only see/manage their own scenarios
ALTER TABLE public.safe_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_scenarios_select" ON public.safe_scenarios;
CREATE POLICY "own_scenarios_select" ON public.safe_scenarios
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_scenarios_insert" ON public.safe_scenarios;
CREATE POLICY "own_scenarios_insert" ON public.safe_scenarios
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_scenarios_update" ON public.safe_scenarios;
CREATE POLICY "own_scenarios_update" ON public.safe_scenarios
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_scenarios_delete" ON public.safe_scenarios;
CREATE POLICY "own_scenarios_delete" ON public.safe_scenarios
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.safe_scenarios IS 'Saved SAFE/convertible-note calculator scenarios, one per user.';
