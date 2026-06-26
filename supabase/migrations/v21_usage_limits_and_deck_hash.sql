-- ═══════════════════════════════════════════════════════════════
-- v21_usage_limits_and_deck_hash.sql
-- Adds a stable PDF fingerprint for duplicate deck prevention and
-- query indexes used by monthly free-tier usage gates.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS deck_sha256 TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'submissions_deck_sha256_format'
  ) THEN
    ALTER TABLE public.submissions
      ADD CONSTRAINT submissions_deck_sha256_format
      CHECK (deck_sha256 IS NULL OR deck_sha256 ~ '^[a-f0-9]{64}$');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS submissions_user_deck_sha_idx
  ON public.submissions (user_id, deck_sha256)
  WHERE deck_sha256 IS NOT NULL;

CREATE INDEX IF NOT EXISTS submissions_user_created_month_idx
  ON public.submissions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mock_pitch_sessions_user_started_month_idx
  ON public.mock_pitch_sessions (user_id, started_at DESC);

COMMENT ON COLUMN public.submissions.deck_sha256 IS
  'SHA-256 fingerprint of the uploaded PDF. Used to prevent duplicate deck analyses for non-admin users while allowing retry after failed analyses.';
