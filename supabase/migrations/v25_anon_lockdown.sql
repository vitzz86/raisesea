-- ═══════════════════════════════════════════════════════════════
-- v25_anon_lockdown.sql
-- P0 security fixes — close two anonymous (public anon-key) exposures.
--
-- FINDING 1 — public.investors had RLS DISABLED.
--   No ENABLE ROW LEVEL SECURITY statement ever ran on this table (v2..v24
--   contain none for it), so the table was served in full to the `anon`
--   role. Measured: an unauthenticated request returned all 742 rows with
--   `email` populated on 742/742 and `linkedin` on 742/742.
--
--   The anon key is the publishable key (sb_publishable_…) and is shipped
--   in the public browser bundle, so this was harvestable by anyone.
--   This was unintended: the only in-app reader — app/api/submit/route.ts —
--   selects an explicit column list that EXCLUDES `email`.
--
-- FINDING 2 — public.get_platform_stats() was EXECUTABLE BY anon.
--   An unauthenticated POST returned total_submissions, total_users,
--   complete/failed analysis counts and total_raise_target_usd ($610M).
--
-- SAFETY ANALYSIS (verified before writing this file):
--   • investors — the only reader is app/api/submit/route.ts, which builds
--     its client from SUPABASE_SERVICE_KEY (service role). No client-side
--     or anon-key path reads this table, so enabling RLS is safe.
--   • get_platform_stats() — the only caller is app/admin/page.tsx via
--     supabaseAdmin (service role). Revoking from PUBLIC is safe.
--   • The service role (secret key) carries BYPASSRLS, so server-side code
--     is unaffected by enabling RLS here.
--   • This migration does NOT alter any table's columns, so the ops-side
--     Master DB sync for `investors` is unaffected (it is service-role too).
--
-- IDEMPOTENT — safe to re-run.
-- RUN ORDER: this file only. No dependencies on other migrations.
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
-- policy with a column-restricted view — never expose `email`/`linkedin`.

COMMENT ON TABLE public.investors IS
  'Investor directory. RLS ENABLED (v25) — service role only. Contains email and linkedin; must never be exposed via the anon key.';

-- ── 2. get_platform_stats() — remove public execution ───────────────────
-- Revoked from PUBLIC (covers anon + authenticated), re-granted to service_role.
-- If this errors with "function does not exist", confirm the signature with
--   SELECT proname, pg_get_function_identity_arguments(oid)
--     FROM pg_proc WHERE proname = 'get_platform_stats';
-- and adjust the argument list below to match.
REVOKE EXECUTE ON FUNCTION public.get_platform_stats() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_platform_stats() TO service_role;

-- ── Verification (run after applying; both must return 0) ───────────────
--   SELECT count(*) FROM public.investors;        -- as anon  -> 0
--   SELECT public.get_platform_stats();            -- as anon  -> permission denied
--   SELECT count(*) FROM public.investors;        -- as service_role -> 742
