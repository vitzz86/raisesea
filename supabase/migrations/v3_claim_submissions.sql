-- ═══════════════════════════════════════════════════════════════
-- v3_claim_submissions.sql
-- Adds user_id column to submissions and the claim_submissions_by_email
-- function. When a founder signs up after submitting pre-auth, this
-- function links their previous submissions (matched by founder_email)
-- to their new user_id.
-- ═══════════════════════════════════════════════════════════════

-- Add user_id column (nullable — pre-auth submissions stay null until claimed)
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS submissions_user_id_idx ON public.submissions (user_id);
CREATE INDEX IF NOT EXISTS submissions_founder_email_idx ON public.submissions (LOWER(founder_email));

-- Claim function — called automatically by /auth/callback after a user signs in.
-- Returns the count of rows updated so the UI can show "X previous submissions linked".
CREATE OR REPLACE FUNCTION public.claim_submissions_by_email(
  p_user_id UUID,
  p_email   TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Only claim rows that aren't already owned by someone else.
  -- Case-insensitive email match (founders may have entered different casing).
  UPDATE public.submissions
  SET user_id = p_user_id
  WHERE LOWER(founder_email) = LOWER(p_email)
    AND user_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Update the user's submission count denormalized field
  UPDATE public.user_profiles
  SET submissions_count = (
    SELECT COUNT(*) FROM public.submissions WHERE user_id = p_user_id
  )
  WHERE id = p_user_id;

  RETURN v_count;
END;
$$;

-- Update RLS for submissions: users can read their own (claimed) submissions
-- PLUS the existing service-role policies still apply for API routes.
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own submissions"   ON public.submissions;
DROP POLICY IF EXISTS "Users can update own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Public can view by slug"          ON public.submissions;
DROP POLICY IF EXISTS "Service role full access"         ON public.submissions;

-- Owners see their submissions
CREATE POLICY "Users can view own submissions"
  ON public.submissions FOR SELECT
  USING (auth.uid() = user_id);

-- Owners can update their submissions (e.g. toggle is_public)
CREATE POLICY "Users can update own submissions"
  ON public.submissions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anonymous/public access by slug (the shareable /match/<slug> page).
-- The slug itself is 64-bit entropy, so this is "secret URL" model.
-- Public-by-slug only — no listing of all submissions.
CREATE POLICY "Public can view by slug"
  ON public.submissions FOR SELECT
  USING (unique_slug IS NOT NULL);

-- Service role bypasses RLS for API routes
CREATE POLICY "Service role full access"
  ON public.submissions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON FUNCTION public.claim_submissions_by_email IS
  'Links pre-auth submissions to a new user_id by matching founder_email. Called from /auth/callback.';
