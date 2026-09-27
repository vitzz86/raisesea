-- ═══════════════════════════════════════════════════════════════
-- v27_fix_avg_deck_score.sql
-- Fixes get_platform_stats().avg_deck_score, which always reported 0.
--
-- SYMPTOM
--   The admin Overview rendered "Avg deck score 0" while 49 of 52 submissions
--   carry a real overall_score (73, 59, …). /dashboard/submissions, reading the
--   SAME rows, rendered "Average score 61/100". So the data was fine and only
--   the SQL path was wrong.
--
-- ROOT CAUSE — double-encoded JSONB
--   submissions.deck_analysis is JSONB (v2_schema.sql), but every writer stores
--   a JSON *string*, not an object:
--     app/api/submit/route.ts:354        deck_analysis: JSON.stringify(...)
--     app/api/analyze/deck/route.ts:14   update({ deck_analysis: JSON.stringify(...) })
--   The column therefore holds a jsonb SCALAR of type 'string' whose text is the
--   analysis object.
--
--   The function did:
--     (deck_analysis::json->>'overall_score') ~ '^[0-9]+$'
--   On a jsonb string, `->>` returns NULL. The regex guard then rejected every
--   row, AVG ran over zero rows, and COALESCE(AVG(...), 0) returned 0 — silently,
--   because 0 is also a legitimate score.
--
-- FIX
--   Unwrap the double-encoded value before reading the key, and keep the guard so
--   a malformed row cannot abort the aggregate:
--     • jsonb_typeof(deck_analysis) = 'string' AND the text starts with '{'
--       -> parse the inner text as jsonb and read overall_score from that;
--     • otherwise read overall_score directly (covers rows written correctly).
--   The numeric guard is widened from ^[0-9]+$ to allow decimals, so a score of
--   "73.5" is no longer discarded.
--
-- WHY THIS ADAPTS THE SQL TO THE DATA (and not the other way round)
--   The double-encoded shape is currently LOAD-BEARING: getDeckScore() in
--   app/dashboard/page.tsx:114 and app/dashboard/submissions/page.tsx:37 does
--   JSON.parse(deckAnalysisJson) on a STRING. Writing real jsonb objects would
--   make JSON.parse() throw and silently zero out every dashboard score. Fixing
--   the writers is a separate, coordinated change (writers + all readers +
--   renderers together) and is deliberately NOT attempted here.
--
-- IDEMPOTENT (CREATE OR REPLACE).
-- RUN ORDER: independent of the other migrations — it only redefines an
-- existing function. Apply in numeric order alongside the rest.
-- ═══════════════════════════════════════════════════════════════

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

    -- Unwrap double-encoded values (see header), then average.
    'avg_deck_score', (
      SELECT COALESCE(ROUND(AVG(raw::numeric), 1), 0)
      FROM (
        SELECT (CASE
                  WHEN jsonb_typeof(deck_analysis) = 'string'
                   AND (deck_analysis #>> '{}') LIKE '{%'
                  THEN (deck_analysis #>> '{}')::jsonb
                  ELSE deck_analysis
                END)->>'overall_score' AS raw
        FROM submissions
        WHERE deck_analysis IS NOT NULL
      ) t
      WHERE raw ~ '^[0-9]+(\.[0-9]+)?$'
    ),

    'total_raise_target_usd',(SELECT COALESCE(SUM(raise_target_usd), 0) FROM submissions)
  )
  INTO v_result;
  RETURN v_result;
END;
$$;

-- CREATE OR REPLACE preserves the existing ACL, so v25's revoke still holds.
-- Restate it anyway so this file is correct when applied on its own.
REVOKE ALL ON FUNCTION public.get_platform_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO service_role;

-- ── Verification ───────────────────────────────────────────────────────
--   SELECT public.get_platform_stats();   -- as service_role
--   Expect avg_deck_score to be a real number (mid-60s with current data),
--   not 0, and every other key unchanged.
