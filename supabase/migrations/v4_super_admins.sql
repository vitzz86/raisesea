-- ═══════════════════════════════════════════════════════════════
-- v4_super_admins.sql
-- Platform admin access list. Two-layer check:
--   1. SUPER_ADMIN_EMAILS env var (fast, no DB call) — handled in lib/super-admin.ts
--   2. super_admins table (this file) — allows runtime additions
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.super_admins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- linked after signup
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS super_admins_email_idx   ON public.super_admins (LOWER(email));
CREATE INDEX IF NOT EXISTS super_admins_user_id_idx ON public.super_admins (user_id);

-- Seed the founder account
INSERT INTO public.super_admins (email, notes)
VALUES ('samudravito4@gmail.com', 'Founder — Rashad Tajuddin')
ON CONFLICT (email) DO NOTHING;

-- Auto-link user_id when a super admin email signs up
CREATE OR REPLACE FUNCTION public.link_super_admin_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.super_admins
  SET user_id = NEW.id
  WHERE LOWER(email) = LOWER(NEW.email)
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_super_admin_user_created ON auth.users;
CREATE TRIGGER on_super_admin_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.link_super_admin_user();

-- Helper: is this user_id a super admin?
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = p_user_id
  );
END;
$$;

-- Aggregated stats for super admin dashboard (chunk 5)
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_submissions',     (SELECT COUNT(*) FROM submissions),
    'total_users',           (SELECT COUNT(*) FROM user_profiles),
    'submissions_today',     (SELECT COUNT(*) FROM submissions WHERE created_at > NOW() - INTERVAL '24 hours'),
    'submissions_this_week', (SELECT COUNT(*) FROM submissions WHERE created_at > NOW() - INTERVAL '7 days'),
    'complete_analyses',     (SELECT COUNT(*) FROM submissions WHERE analysis_status = 'complete'),
    'failed_analyses',       (SELECT COUNT(*) FROM submissions WHERE analysis_status = 'failed'),
    'avg_deck_score',        (SELECT COALESCE(ROUND(AVG((deck_analysis::json->>'overall_score')::int)::numeric, 1), 0)
                              FROM submissions
                              WHERE deck_analysis IS NOT NULL
                                AND (deck_analysis::json->>'overall_score') ~ '^[0-9]+$'),
    'total_raise_target_usd',(SELECT COALESCE(SUM(raise_target_usd), 0) FROM submissions)
  )
  INTO v_result;
  RETURN v_result;
END;
$$;

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.super_admins;

-- Only service role can read/write super_admins (never expose to clients)
CREATE POLICY "Service role only"
  ON public.super_admins FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.super_admins IS
  'Platform admin access list. Used by middleware + /admin route. samudravito4@gmail.com hardcoded.';
