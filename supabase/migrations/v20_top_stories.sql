-- ═══════════════════════════════════════════════════════════════
-- v20_top_stories.sql
-- Categorized "Top stories" become part of the weekly Editor's Take
-- artifact: generated, reviewed, and approved together. Stored as a
-- single JSONB blob on editors_takes so it shares the same approval
-- lifecycle (pending → approved → shown on /news).
--
-- Shape (one top story per category, any may be null for a quiet week):
-- {
--   "fundraising": { "id","headline","why","sector","country","coverage","sources":[{"name","url"}],"source_url" } | null,
--   "tech":        { ... } | null,
--   "policy":      { ... } | null,
--   "exit":        { ... } | null
-- }
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.editors_takes
  ADD COLUMN IF NOT EXISTS top_stories JSONB;

COMMENT ON COLUMN public.editors_takes.top_stories
  IS 'AI-selected top story per category (fundraising/tech/policy/exit), with real source coverage attached. Generated + approved alongside the take.';
