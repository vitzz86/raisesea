-- ═══════════════════════════════════════════════════════════════
-- v12_editors_take_structured.sql
-- Chunk 8.16: structured editor's take (headline / body / takeaway).
-- The existing `content` column is kept as a fallback / full-text mirror.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.editors_takes
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS takeaway TEXT;

COMMENT ON COLUMN public.editors_takes.headline IS 'Punchy 5-10 word headline for the weekly take';
COMMENT ON COLUMN public.editors_takes.body IS 'The main 2-4 sentence analysis (without headline/takeaway)';
COMMENT ON COLUMN public.editors_takes.takeaway IS 'One actionable "what to do" line for founders';
