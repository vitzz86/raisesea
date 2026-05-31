-- ═══════════════════════════════════════════════════════════════
-- v19_user_feedback.sql
-- Beta tester feedback collection.
--
-- Stores per-task ratings (1-10 scale) + free-text message.
-- Each user can submit one feedback per task_key (idempotent via unique key).
-- Re-submitting updates the existing row (allows users to refine feedback).
--
-- task_key values (enforced at app layer, not DB, to allow easy expansion):
--   - 'deck_analysis'    — after first deck analysis
--   - 'mock_pitch'       — after first mock pitch session
--   - 'calculator'       — after using a calculator
--   - 'crm'              — after adding first CRM contact
--   - 'meeting_request'  — after sending first meeting request
--   - 'final_overall'    — NPS-style overall survey
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_key    TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
  message     TEXT,                              -- optional free text, max ~2000 chars enforced app-side
  page_url    TEXT,                              -- where the modal was opened (for debugging)
  user_agent  TEXT,                              -- browser info (for repro)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One feedback per user per task. Re-submission overwrites.
  UNIQUE (user_id, task_key)
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_task     ON public.user_feedback (task_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user     ON public.user_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating   ON public.user_feedback (rating, task_key);

-- updated_at trigger so refinements bump the timestamp
CREATE OR REPLACE FUNCTION public.tg_user_feedback_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_feedback_touch ON public.user_feedback;
CREATE TRIGGER user_feedback_touch
  BEFORE UPDATE ON public.user_feedback
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_feedback_touch();

-- ─── RLS ─────────────────────────────────────────────────
-- Users can read/write their own feedback. Admin reads via service role
-- (bypasses RLS) from the /admin/feedback API route.
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own feedback" ON public.user_feedback;
CREATE POLICY "Users can read own feedback"
  ON public.user_feedback FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.user_feedback;
CREATE POLICY "Users can insert own feedback"
  ON public.user_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own feedback" ON public.user_feedback;
CREATE POLICY "Users can update own feedback"
  ON public.user_feedback FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- No DELETE policy — feedback is permanent record. Admin can soft-handle in app.

COMMENT ON TABLE public.user_feedback IS
  'Beta tester feedback: per-task rating (1-10) + optional free text. Unique on (user_id, task_key).';
