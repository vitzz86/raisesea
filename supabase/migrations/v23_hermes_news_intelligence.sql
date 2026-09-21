-- ═══════════════════════════════════════════════════════════════
-- v23_hermes_news_intelligence.sql
-- Hermes-owned automation, regional coverage and run observability.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.news_pipeline_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_key         TEXT NOT NULL UNIQUE,
  mode            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'running',
  triggered_by    TEXT NOT NULL DEFAULT 'hermes',
  model           TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  stats           JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_health   JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT news_pipeline_runs_mode_check
    CHECK (mode IN ('daily', 'weekly', 'dry-run', 'source-audit')),
  CONSTRAINT news_pipeline_runs_status_check
    CHECK (status IN ('running', 'succeeded', 'failed', 'dry_run'))
);

CREATE INDEX IF NOT EXISTS news_pipeline_runs_started_idx
  ON public.news_pipeline_runs (started_at DESC);

ALTER TABLE public.news_pipeline_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS source_tier TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_run_id UUID REFERENCES public.news_pipeline_runs(id) ON DELETE SET NULL;

ALTER TABLE public.news_items DROP CONSTRAINT IF EXISTS news_items_region_scope_check;
ALTER TABLE public.news_items ADD CONSTRAINT news_items_region_scope_check
  CHECK (region_scope IN ('sea', 'apac', 'global'));

ALTER TABLE public.news_items DROP CONSTRAINT IF EXISTS news_items_source_tier_check;
ALTER TABLE public.news_items ADD CONSTRAINT news_items_source_tier_check
  CHECK (source_tier IS NULL OR source_tier IN ('primary', 'specialist', 'aggregator'));

ALTER TABLE public.news_items DROP CONSTRAINT IF EXISTS news_items_ai_confidence_check;
ALTER TABLE public.news_items ADD CONSTRAINT news_items_ai_confidence_check
  CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1));

CREATE INDEX IF NOT EXISTS news_items_pipeline_run_idx
  ON public.news_items (pipeline_run_id);

CREATE INDEX IF NOT EXISTS news_items_scope_published_idx
  ON public.news_items (region_scope, published_at DESC);

COMMENT ON TABLE public.news_pipeline_runs
  IS 'One auditable Hermes news-intelligence run, including source health and outcome statistics.';
COMMENT ON COLUMN public.news_items.ai_confidence
  IS 'Hermes model confidence from 0 to 1 used by the automatic publication policy.';
COMMENT ON COLUMN public.news_items.review_reason
  IS 'Why an ambiguous item was placed in the optional, non-blocking review queue.';
COMMENT ON COLUMN public.news_items.region_scope
  IS 'sea = Southeast Asia, apac = China/Japan/South Korea, global = major external signal relevant to SEA founders.';
