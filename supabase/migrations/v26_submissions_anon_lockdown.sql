-- ═══════════════════════════════════════════════════════════════
-- v26_submissions_anon_lockdown.sql
-- Remove ALL anonymous read access to public.submissions.
--
-- FINDING
--   Measured live before this migration: an unauthenticated request with the
--   publishable (anon) key returned all 51 rows of `submissions`, with
--   founder_email populated on every one.
--
--   Cause: a permissive row-level policy on the table. v3_claim_submissions.sql
--   created "Public can view by slug" (FOR SELECT USING (unique_slug IS NOT
--   NULL)), which is effectively USING (true) — every row has a slug, so the
--   predicate is always satisfied and the whole table was enumerable, not just
--   rows reached "by slug". v7_expert_profiles.sql dropped that policy, but the
--   live table still answers anonymous reads, so a permissive policy is still
--   in force (the drop did not stick, or a later change re-added one). This
--   migration therefore drops every known public policy by name AND revokes the
--   table privilege, so the lock does not depend on which name won.
--
--   The dangerous part was never the row filter, it was the COLUMN scope: the
--   client-side report view queried `.select('*')` with the anon key, so a
--   single slug yielded founder_email, founder_linkedin and the full deck
--   analysis. A row-level policy cannot express "only when queried by slug".
--
-- FIX IN THE APP (same PR — do not apply this migration without it)
--   app/match/[id]/MatchView.tsx no longer touches the database. The server
--   component app/match/[id]/page.tsx already loaded the row with the service
--   role and enforced the owner / is_public / super-admin gate; it now loads
--   the full row and passes it down as a prop, stripping founder_email first.
--   Verified: that client query was the ONLY anonymous reader of this table —
--   every other reader (/api/export-pdf, the /meet pages, the dashboard, admin)
--   already used SUPABASE_SERVICE_KEY.
--
-- SAFETY
--   • Owners keep access through the existing owner policy, so /dashboard and
--     /dashboard/submissions are unaffected.
--   • Service role carries BYPASSRLS, so all server routes are unaffected.
--   • `anon` loses read access; `authenticated` keeps it (owner policy applies).
--
-- IDEMPOTENT — safe to re-run.
-- RUN ORDER: after v25_anon_lockdown.sql. Independent of every other file.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Drop every public-view policy that has ever existed on this table.
DROP POLICY IF EXISTS "Public can view by slug"      ON public.submissions;
DROP POLICY IF EXISTS "Public can view if is_public" ON public.submissions;
DROP POLICY IF EXISTS "Public can view if public"    ON public.submissions;
DROP POLICY IF EXISTS "Anyone can view public"       ON public.submissions;

-- Belt and braces: even if some future policy is created FOR SELECT TO anon,
-- the role cannot read the table without the privilege.
REVOKE SELECT ON public.submissions FROM anon;

-- NOTE: this deliberately leaves the grants of `authenticated` and the owner
-- policy untouched. If a public-read path is ever needed again, add an explicit
-- policy AND a column-restricted view — never `SELECT *` to `anon`.

COMMENT ON TABLE public.submissions IS
  'Deck submissions. Anonymous read access REVOKED (v26) — public report links are served server-side via the service role after a slug + is_public check. Contains founder PII; never expose to the anon key.';

-- ── Verification (run after applying) ───────────────────────────────────
--   as anon           : SELECT count(*) FROM public.submissions;   -> 0 (or permission denied)
--   as service_role   : SELECT count(*) FROM public.submissions;   -> 51
--   as a signed-in owner, /dashboard/submissions still lists their own rows.
--   Anonymous GET of a public share link /match/<slug> still renders.
