-- ═══════════════════════════════════════════════════════════════
-- v11_news_region_scope.sql
-- Chunk 8 enhancement: tag each news item as 'sea' or 'global' so we
-- can maintain an 80/20 SEA/global balance and show region tags.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS region_scope TEXT NOT NULL DEFAULT 'sea';

ALTER TABLE public.news_items DROP CONSTRAINT IF EXISTS news_items_region_scope_check;
ALTER TABLE public.news_items ADD CONSTRAINT news_items_region_scope_check
  CHECK (region_scope IN ('sea', 'global'));

CREATE INDEX IF NOT EXISTS news_items_region_scope_idx ON public.news_items (region_scope);

COMMENT ON COLUMN public.news_items.region_scope
  IS 'sea = Southeast Asia news, global = US/China/Japan/Korea/Europe news relevant to SEA founders';
