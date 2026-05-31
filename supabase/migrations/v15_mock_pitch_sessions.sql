-- ═══════════════════════════════════════════════════════════════
-- v15_mock_pitch_sessions.sql
-- Chunk 11: Mock Pitch + Q&A sessions.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.mock_pitch_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Which submission/deck this practice session is tied to
  submission_id   UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  -- Mode + plan
  mode            TEXT NOT NULL CHECK (mode IN ('pitch', 'qa')),
  duration_min    INT NOT NULL CHECK (duration_min IN (3, 5, 10)),
  -- For Q&A: the pre-generated questions for this session
  questions       JSONB,
  -- Transcript: structured per-mode
  --   pitch: [{slide:int, text:string, ts:string}]
  --   qa:    [{q:string, a:string, ts:string}]
  transcript      JSONB,
  -- Debrief (post-session AI evaluation)
  debrief         JSONB,
  -- Lifecycle
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mock_pitch_user_idx ON public.mock_pitch_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS mock_pitch_submission_idx ON public.mock_pitch_sessions (submission_id);

-- Auto-bump updated_at
CREATE OR REPLACE FUNCTION public.mock_pitch_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mock_pitch_touch ON public.mock_pitch_sessions;
CREATE TRIGGER mock_pitch_touch
  BEFORE UPDATE ON public.mock_pitch_sessions
  FOR EACH ROW EXECUTE FUNCTION public.mock_pitch_touch_updated_at();

-- RLS
ALTER TABLE public.mock_pitch_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_mock_pitch_select" ON public.mock_pitch_sessions;
CREATE POLICY "own_mock_pitch_select" ON public.mock_pitch_sessions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_mock_pitch_insert" ON public.mock_pitch_sessions;
CREATE POLICY "own_mock_pitch_insert" ON public.mock_pitch_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_mock_pitch_update" ON public.mock_pitch_sessions;
CREATE POLICY "own_mock_pitch_update" ON public.mock_pitch_sessions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_mock_pitch_delete" ON public.mock_pitch_sessions;
CREATE POLICY "own_mock_pitch_delete" ON public.mock_pitch_sessions FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.mock_pitch_sessions IS 'Mock pitch + Q&A practice sessions, linked to a deck analysis.';
