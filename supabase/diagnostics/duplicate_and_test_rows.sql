-- ═══════════════════════════════════════════════════════════════
-- READ-ONLY diagnostic: duplicate submissions and suspected test rows.
--
-- NOT A MIGRATION. This file changes nothing — every statement is a SELECT.
-- Run it in the Supabase SQL editor to see the shape of the data, then decide
-- what to clean up. Nothing here is applied automatically, because deciding
-- which of two identical rows is "the real one" is a product call, not a
-- migration.
--
-- Context: production holds 52 submissions across only 20 distinct users.
-- Repeats include nemu.ai x4, TOMAZZ BIZNIZ x3 and CURAWEDA PALAGAN INNOTECH
-- x3 (with case-variant duplicates), Noovoleum x3, CURAWEDA x2, reekan x2
-- (case-variant "Reekan") and SAFEUP x2. These inflate the admin's
-- total_raise_target_usd (~$610M), which sums every row.
--
-- Root cause of the repeats is fixed in the same PR: the duplicate-deck gate
-- in app/api/submit/route.ts sat behind `!bypassFreeLimits`, so super admins
-- (who bypass limits) and session-less flows were never deduplicated.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Duplicate clusters: same user, same company name (case/space-insensitive)
SELECT
  lower(btrim(company_name))            AS company_key,
  user_id,
  count(*)                              AS rows,
  min(created_at)                       AS first_seen,
  max(created_at)                       AS last_seen,
  array_agg(unique_slug ORDER BY created_at) AS slugs,
  sum(raise_target_usd)                 AS raise_summed_usd
FROM public.submissions
GROUP BY 1, 2
HAVING count(*) > 1
ORDER BY rows DESC, company_key;

-- ── 2. Same deck bytes submitted more than once by the same user
-- (the unique index on (user_id, deck_sha256) only covers non-NULL hashes, so
--  this should be empty — it is a check that the index is actually working)
SELECT
  user_id,
  deck_sha256,
  count(*) AS rows,
  array_agg(unique_slug ORDER BY created_at) AS slugs
FROM public.submissions
WHERE deck_sha256 IS NOT NULL
GROUP BY 1, 2
HAVING count(*) > 1
ORDER BY rows DESC;

-- ── 3. How many rows fall OUTSIDE the partial unique index?
-- These are the rows that could duplicate freely.
SELECT
  count(*) FILTER (WHERE deck_sha256 IS NULL) AS rows_without_hash,
  count(*)                                    AS rows_total
FROM public.submissions;

-- ── 4. Suspected test / placeholder rows seen during the audit.
-- Note this is a heuristic list to REVIEW, not a verdict — company_name and
-- founder_email are free text.
SELECT
  id, unique_slug, company_name, founder_email, stage, sector,
  raise_target_usd, analysis_status, is_public, created_at
FROM public.submissions
WHERE founder_email ILIKE ANY (ARRAY[
        'ini.bapak.budi@%', 'gptmm211@%', 'blrshop12@%',
        'taxpointid@%', 'tomazz.marketing@%'
      ])
   OR company_name ILIKE ANY (ARRAY[
        'Ahmad Santoso', 'gpt mm', 'Bryan Liam', 'Tax Point',
        'test%', '%demo%', '%sample%'
      ])
ORDER BY created_at;

-- ── 5. How much the headline total is inflated
SELECT
  count(*)                                          AS rows_total,
  count(DISTINCT (user_id, deck_sha256))            AS distinct_user_decks,
  sum(raise_target_usd)                             AS total_raise_all_rows,
  sum(raise_target_usd) FILTER (
    WHERE deck_sha256 IS NOT NULL
  )                                                 AS total_raise_hashed_rows
FROM public.submissions;
