-- ═══════════════════════════════════════════════════════════════
-- v7_expert_profiles.sql
-- Chunk 6 — Expert applications with approval gate + multi-category
-- + expertise areas + privacy fix on submissions.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Extend vc_profiles for the expert marketplace ────────────
-- Table created in v6. We keep the legacy `profile_type` column
-- (singular) for backward compat — code now uses `profile_types` (array).

ALTER TABLE public.vc_profiles
  ADD COLUMN IF NOT EXISTS profile_types       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS expertise_areas     TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS what_i_offer        TEXT,
  ADD COLUMN IF NOT EXISTS years_experience    INTEGER,
  ADD COLUMN IF NOT EXISTS languages           TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS application_status  TEXT   NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS application_notes   TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- application_status values: 'pending' | 'active' | 'rejected'
ALTER TABLE public.vc_profiles
  DROP CONSTRAINT IF EXISTS vc_profiles_app_status_check;
ALTER TABLE public.vc_profiles
  ADD CONSTRAINT vc_profiles_app_status_check
    CHECK (application_status IN ('pending', 'active', 'rejected'));

-- Indexes for the directory listing + admin pending queue
CREATE INDEX IF NOT EXISTS vc_profiles_status_idx
  ON public.vc_profiles (application_status);
CREATE INDEX IF NOT EXISTS vc_profiles_types_idx
  ON public.vc_profiles USING GIN (profile_types);
CREATE INDEX IF NOT EXISTS vc_profiles_expertise_idx
  ON public.vc_profiles USING GIN (expertise_areas);

-- RLS — refine policies for the approval flow
DROP POLICY IF EXISTS "Listed VCs are publicly viewable" ON public.vc_profiles;
DROP POLICY IF EXISTS "Active experts are publicly viewable" ON public.vc_profiles;

-- Public directory only shows APPROVED experts who chose to be listed
CREATE POLICY "Active experts are publicly viewable"
  ON public.vc_profiles FOR SELECT
  USING (application_status = 'active' AND is_listed = TRUE AND is_active = TRUE);


-- ── 2. Privacy fix on submissions ───────────────────────────────
-- Existing policy "Public can view by slug" let ANYONE with the slug read
-- the row regardless of is_public. Now we enforce is_public=true OR the
-- viewer is the owner. Super admins bypass via service role.

ALTER TABLE public.submissions
  ALTER COLUMN is_public SET DEFAULT TRUE;

-- Backfill: existing rows with NULL is_public become true (shareable as before)
UPDATE public.submissions SET is_public = TRUE WHERE is_public IS NULL;

DROP POLICY IF EXISTS "Public can view by slug" ON public.submissions;

-- New policy: anonymous reads only allowed when explicitly public
CREATE POLICY "Public can view if is_public"
  ON public.submissions FOR SELECT
  USING (is_public = TRUE AND unique_slug IS NOT NULL);

-- Owners always see their own submissions (already exists from v3, redundant safety)
DROP POLICY IF EXISTS "Users can view own submissions" ON public.submissions;
CREATE POLICY "Users can view own submissions"
  ON public.submissions FOR SELECT
  USING (auth.uid() = user_id);


-- ── 3. Helper: count pending expert applications ────────────────
-- Used by the super admin Overview tab to surface a "X pending review" badge

CREATE OR REPLACE FUNCTION public.count_pending_experts()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.vc_profiles WHERE application_status = 'pending';
$$;


COMMENT ON COLUMN public.vc_profiles.profile_types  IS 'Multi-select: vc, cvc, corporate, angel, advisor, domain_expert';
COMMENT ON COLUMN public.vc_profiles.expertise_areas IS 'Free-form chips: "Go-to-market", "Series A fundraising", "B2B sales", etc.';
COMMENT ON COLUMN public.vc_profiles.what_i_offer    IS 'Free-text description of what the expert provides to founders.';
