-- ═══════════════════════════════════════════════════════════════
-- v28_reconcile_stale_pending.sql
-- Resolves submissions stranded in analysis_status = 'pending'.
--
-- FINDING
--   A submission created 2026-05-21 was still 'pending' — over four months.
--   It is not alone; 'pending' is the column DEFAULT (v2_schema.sql:15) and any
--   row written by an older code path that inserted first and updated later is
--   stranded if that update never ran.
--
-- WHY A 'pending' ROW CAN NEVER RESOLVE NOW
--   app/api/submit/route.ts:361 is the ONLY writer of analysis_status, and it
--   sets it explicitly on insert:
--       analysis_status: fullAnalysis ? 'complete' : 'failed'
--   The row is inserted AFTER the analysis has already run, so no in-flight
--   submission is ever stored as 'pending'. A 'pending' row therefore means the
--   writing request died (or ran under the pre-v2 write path) and nothing will
--   ever come back to finish it. The UI then shows a perpetual "Pending" that
--   no one can act on, and lib/usage-limits.ts counts the row as neither
--   complete nor failed.
--
-- WHAT THIS DOES
--   Marks those rows 'failed' and records why, so the dashboard and the admin
--   counters describe reality. Bounded to rows older than 24 hours so a row
--   inserted moments ago (clock skew, in-flight transaction) cannot be caught.
--   Only rows still 'pending' are touched; anything already complete or failed
--   is left alone.
--
-- NOT DESTRUCTIVE: a bounded UPDATE with a WHERE clause. No row is deleted and
-- no column is dropped. The original created_at is preserved, so the history is
-- still readable.
--
-- IDEMPOTENT — re-running matches zero rows once applied.
-- RUN ORDER: independent of v25–v27. Apply in numeric order.
-- ═══════════════════════════════════════════════════════════════

-- How many rows are affected? Run this first if you want the number before
-- applying:
--   SELECT count(*) FROM public.submissions
--   WHERE analysis_status = 'pending' AND created_at < NOW() - INTERVAL '24 hours';

UPDATE public.submissions
SET analysis_status = 'failed',
    analysis_error  = COALESCE(
      analysis_error,
      'Marked failed by v28: left in ''pending'' by a write path that no longer exists. analysis_status is set explicitly on insert now, so a pending row can never resolve.'
    )
WHERE analysis_status = 'pending'
  AND created_at < NOW() - INTERVAL '24 hours';

-- ── Verification ───────────────────────────────────────────────────────
--   SELECT analysis_status, count(*) FROM public.submissions GROUP BY 1;
--   Expect zero 'pending' rows (unless one was inserted in the last 24h).
