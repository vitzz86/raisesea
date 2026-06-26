-- ═══════════════════════════════════════════════════════════════
-- v22_incubator_unpad_workspace.sql
-- Real incubator workspace support for Unpad and future partners.
-- Super admins operate the workspace; startups can later be mapped
-- to users through founder_user_id / founder_email.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.incubator_startups (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  institution_slug  TEXT NOT NULL DEFAULT 'unpad',
  cohort            TEXT NOT NULL DEFAULT 'Unpad 2026 Batch A',
  name              TEXT NOT NULL,
  founder_name      TEXT,
  founder_email     TEXT,
  founder_user_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  faculty           TEXT,
  sector            TEXT,
  stage             TEXT,
  status            TEXT NOT NULL DEFAULT 'Applied',
  mentor_name       TEXT,
  one_liner         TEXT,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  latest_score      INTEGER,
  previous_score    INTEGER,
  latest_delta      INTEGER,
  latest_version    INTEGER NOT NULL DEFAULT 0,
  latest_activity_at TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT incubator_startups_status_check CHECK (status IN (
    'Applied', 'Screening', 'Accepted', 'Incubating', 'Demo Day Ready', 'Alumni'
  ))
);

CREATE INDEX IF NOT EXISTS incubator_startups_institution_idx
  ON public.incubator_startups (institution_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS incubator_startups_founder_user_idx
  ON public.incubator_startups (founder_user_id)
  WHERE founder_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.incubator_deck_versions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  institution_slug    TEXT NOT NULL DEFAULT 'unpad',
  startup_id          UUID NOT NULL REFERENCES public.incubator_startups(id) ON DELETE CASCADE,
  submission_id       UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  previous_submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  version             INTEGER NOT NULL,
  deck_sha256         TEXT,
  score               INTEGER,
  previous_score      INTEGER,
  score_delta         INTEGER,
  dimension_scores    JSONB NOT NULL DEFAULT '{}'::jsonb,
  dimension_deltas    JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary             TEXT,
  next_focus          TEXT,
  mentor_prompt       TEXT,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (startup_id, version),
  UNIQUE (startup_id, submission_id),
  CONSTRAINT incubator_deck_versions_deck_hash_format
    CHECK (deck_sha256 IS NULL OR deck_sha256 ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS incubator_deck_versions_startup_idx
  ON public.incubator_deck_versions (startup_id, version DESC);

CREATE INDEX IF NOT EXISTS incubator_deck_versions_submission_idx
  ON public.incubator_deck_versions (submission_id);

CREATE UNIQUE INDEX IF NOT EXISTS incubator_deck_versions_startup_hash_idx
  ON public.incubator_deck_versions (startup_id, deck_sha256)
  WHERE deck_sha256 IS NOT NULL;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS institution_slug TEXT,
  ADD COLUMN IF NOT EXISTS incubator_startup_id UUID REFERENCES public.incubator_startups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deck_version INTEGER,
  ADD COLUMN IF NOT EXISTS previous_submission_id UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deck_score_delta INTEGER,
  ADD COLUMN IF NOT EXISTS deck_dimension_deltas JSONB;

CREATE INDEX IF NOT EXISTS submissions_incubator_startup_idx
  ON public.submissions (incubator_startup_id, created_at DESC)
  WHERE incubator_startup_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.touch_incubator_startup_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_incubator_startup_updated_at ON public.incubator_startups;
CREATE TRIGGER trg_touch_incubator_startup_updated_at
  BEFORE UPDATE ON public.incubator_startups
  FOR EACH ROW EXECUTE FUNCTION public.touch_incubator_startup_updated_at();

COMMENT ON TABLE public.incubator_startups IS
  'Institution startup records used by partner incubator workspaces such as Unpad.';

COMMENT ON TABLE public.incubator_deck_versions IS
  'Versioned deck analyses attached to incubator startups, including score and dimension deltas versus the prior deck.';
