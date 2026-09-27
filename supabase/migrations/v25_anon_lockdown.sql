-- ═══════════════════════════════════════════════════════════════
-- v25_anon_lockdown.sql
-- P0 anonymous-access lockdown: table exposure + SECURITY DEFINER
-- function exposure.
--
-- This file consolidates two overlapping bodies of work: the table fix found
-- by a live audit of production, and the function-privilege fix already
-- written — but never merged — on the fix/security-hardening branch as
-- supabase/migrations/v23_security_hardening.sql. That branch could not merge
-- as-is: it numbered itself v23, which now collides with
-- v23_hermes_news_intelligence.sql on main. It also never mentioned
-- `investors` at all. One file, next free number, both fixes.
--
-- ── FINDING 1 — public.investors had RLS DISABLED ───────────────
--   No ENABLE ROW LEVEL SECURITY statement for this table exists in any
--   migration, and the table was served in full to the `anon` role. Measured:
--   an unauthenticated request returned all 742 rows with `email` populated on
--   742/742 and `linkedin` on 742/742.
--
--   The anon key is the publishable key and ships in the public browser
--   bundle, so this was harvestable by anyone. Unintended: the only in-app
--   reader — app/api/submit/route.ts — selects an explicit column list that
--   EXCLUDES email.
--
-- ── FINDING 2 — seven SECURITY DEFINER functions EXECUTABLE BY anon ──
--   PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Each of
--   these runs as its definer and therefore BYPASSES RLS, so an unauthenticated
--   caller could invoke them through PostgREST. Measured: an anonymous call to
--   get_platform_stats() returned total_users, total_submissions,
--   failed_analyses and total_raise_target_usd (~$610M).
--
--   CALLER AUDIT — every path verified, not assumed. All seven are
--   service-role only, and NO row-level policy or trigger references any of
--   them, so revoking from `authenticated` as well as `anon` is safe:
--     get_platform_stats          app/admin/page.tsx          supabaseAdmin
--     set_oauth_token             lib/token-storage.ts        supabaseAdmin
--     get_oauth_token             lib/token-storage.ts        supabaseAdmin
--     claim_submissions_by_email  app/auth/callback/route.ts  supabaseAdmin
--     is_super_admin              not called via RPC from the app at all
--     count_pending_experts       not called via RPC from the app at all
--     ensure_oauth_key            called internally by the two oauth functions
--
-- ── SAFETY ─────────────────────────────────────────────────────
--   • The service role (secret key) carries BYPASSRLS, so server code is
--     unaffected by enabling RLS and keeps EXECUTE via the explicit GRANTs.
--   • No column or table shape changes, so the ops-side Master DB sync for
--     `investors` (also service-role) is unaffected.
--   • `submissions` is handled separately, in v26_submissions_anon_lockdown.sql
--     together with its app-side change.
--
-- IDEMPOTENT — safe to re-run.
-- RUN ORDER: this file only. No dependency on v26 or any other migration.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. investors — enable RLS and lock to the service role ──────────────
-- Without this the table is world-readable; with RLS on and no policy for
-- anon/authenticated, those roles read zero rows.
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

-- Service role keeps full access. (BYPASSRLS makes this policy partly
-- belt-and-braces, but it documents intent and survives a future role change.)
-- Matches the pattern already used on submissions / vc_profiles.
DROP POLICY IF EXISTS "Service role full access" ON public.investors;
CREATE POLICY "Service role full access"
  ON public.investors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No policy is created for anon or authenticated on purpose.
-- If a future feature needs read access for logged-in users, add an explicit
-- policy over a column-restricted view — never expose email / linkedin.

COMMENT ON TABLE public.investors IS
  'Investor directory. RLS ENABLED (v25) — service role only. Contains email and linkedin; must never be exposed via the anon key.';

-- ── 2. SECURITY DEFINER functions — revoke public execution ─────────────
-- Resolved through pg_proc by NAME rather than by hardcoded signatures, so a
-- statement cannot fail on an argument-type mismatch, and a function that does
-- not exist in this environment is skipped with a NOTICE instead of aborting
-- the whole migration part-way through.
DO $$
DECLARE
  targets text[] := ARRAY[
    'claim_submissions_by_email',
    'is_super_admin',
    'get_platform_stats',
    'count_pending_experts',
    'ensure_oauth_key',
    'set_oauth_token',
    'get_oauth_token'
  ];
  rec record;
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(targets)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', rec.sig);
    RAISE NOTICE 'v25: locked down %', rec.sig;
  END LOOP;
END $$;

-- ── 3. Stop the next function leaking the same way ─────────────────────
-- The default PUBLIC grant is the underlying cause of FINDING 2, so change the
-- default for functions created in this schema from here on.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ── Verification (run after applying) ──────────────────────────────────
--   as anon:          SELECT count(*) FROM public.investors;  -> 0 / permission denied
--   as service_role:  SELECT count(*) FROM public.investors;  -> 742
--   as anon:          SELECT public.get_platform_stats();     -> permission denied
--   /admin still renders its stats (that path uses the service role).
--   Confirm the grants took:
--   SELECT proname, proacl FROM pg_proc WHERE proname = ANY(ARRAY[
--     'get_platform_stats','is_super_admin','set_oauth_token','get_oauth_token',
--     'claim_submissions_by_email','count_pending_experts','ensure_oauth_key']);
