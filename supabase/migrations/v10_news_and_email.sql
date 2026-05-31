-- ═══════════════════════════════════════════════════════════════
-- v10_news_and_email.sql
-- Chunk 8 — News intelligence + email digest infrastructure
-- ═══════════════════════════════════════════════════════════════

-- ── 1. news_items: the working pool of news ─────────────────────
-- Items are inserted by the RSS+Gemini pipeline with status='pending',
-- then super admin reviews + approves/rejects via /admin/news.
-- Approved items get included in the next weekly digest.

CREATE TABLE IF NOT EXISTS public.news_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category                TEXT NOT NULL,                    -- 'fundraising' | 'tech' | 'policy' | 'exit'
  title                   TEXT NOT NULL,
  -- Funding deal specifics (nullable for non-fundraising categories)
  company_name            TEXT,
  amount_usd              BIGINT,
  stage                   TEXT,                              -- Pre-seed | Seed | Series A...
  sector                  TEXT,
  country                 TEXT,
  lead_investor           TEXT,
  -- Common fields
  source_url              TEXT NOT NULL,
  source_name             TEXT,                              -- 'Tech in Asia' | 'e27' | etc.
  ai_summary              TEXT,                              -- AI-extracted summary
  ai_why_it_matters       TEXT,                              -- Opinionated "so what" — visible to logged-in users
  status                  TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
  reject_reason           TEXT,
  -- Timestamps
  published_at            TIMESTAMPTZ,                       -- When the article was originally published
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at             TIMESTAMPTZ,
  approved_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Digest scheduling
  included_in_digest_id   UUID                               -- references news_digests(id) once sent
);

CREATE INDEX IF NOT EXISTS news_items_status_idx        ON public.news_items (status);
CREATE INDEX IF NOT EXISTS news_items_category_idx      ON public.news_items (category);
CREATE INDEX IF NOT EXISTS news_items_sector_idx        ON public.news_items (sector);
CREATE INDEX IF NOT EXISTS news_items_published_idx     ON public.news_items (published_at DESC);
CREATE INDEX IF NOT EXISTS news_items_source_url_uniq   ON public.news_items (source_url);

-- Dedup: same source_url should never be inserted twice
ALTER TABLE public.news_items DROP CONSTRAINT IF EXISTS news_items_source_url_unique;
ALTER TABLE public.news_items ADD CONSTRAINT news_items_source_url_unique UNIQUE (source_url);

-- Status check
ALTER TABLE public.news_items DROP CONSTRAINT IF EXISTS news_items_status_check;
ALTER TABLE public.news_items ADD CONSTRAINT news_items_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Category check
ALTER TABLE public.news_items DROP CONSTRAINT IF EXISTS news_items_category_check;
ALTER TABLE public.news_items ADD CONSTRAINT news_items_category_check
  CHECK (category IN ('fundraising', 'tech', 'policy', 'exit'));


-- RLS — public can read approved items (titles only); logged-in users see AI commentary
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Approved news public read" ON public.news_items;
CREATE POLICY "Approved news public read"
  ON public.news_items FOR SELECT
  USING (status = 'approved');


-- ── 2. news_digests: audit log of what was sent each Monday ─────

CREATE TABLE IF NOT EXISTS public.news_digests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  week_label            TEXT,                          -- e.g. "Week of June 2, 2026"
  -- Editor's take — the AI-generated opinion paragraph at the top
  editors_take          TEXT,
  -- Snapshot stats
  total_recipients      INTEGER NOT NULL DEFAULT 0,
  total_items           INTEGER NOT NULL DEFAULT 0,
  -- JSON snapshot of which items were in this digest (denormalized for audit)
  item_ids              UUID[] NOT NULL DEFAULT '{}',
  -- Cron tracking
  triggered_by          TEXT NOT NULL DEFAULT 'cron',  -- 'cron' | 'manual_admin'
  triggered_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS news_digests_sent_idx ON public.news_digests (sent_at DESC);


-- ── 3. User preferences for email digest ────────────────────────
-- Add unsubscribe toggle + last-sent tracking on user_profiles

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS email_digest_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_digest_sent_at   TIMESTAMPTZ;


-- ── 4. Editor's takes — kept in their own table so multiple drafts ──
-- can exist per week, super admin picks one to include in the digest.

CREATE TABLE IF NOT EXISTS public.editors_takes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_starting DATE NOT NULL,                       -- the Monday this is for
  content       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',     -- pending | approved | rejected
  generated_by  TEXT NOT NULL DEFAULT 'ai',          -- 'ai' | 'manual'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at   TIMESTAMPTZ,
  approved_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS editors_takes_week_idx ON public.editors_takes (week_starting DESC, status);

ALTER TABLE public.editors_takes DROP CONSTRAINT IF EXISTS editors_takes_status_check;
ALTER TABLE public.editors_takes ADD CONSTRAINT editors_takes_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));


COMMENT ON TABLE public.news_items     IS 'News articles fetched by RSS pipeline + AI-extracted summary. Reviewed by super admin before included in digest.';
COMMENT ON TABLE public.news_digests   IS 'Audit log of weekly digests sent — what items, when, who triggered.';
COMMENT ON TABLE public.editors_takes  IS 'AI-generated opinion paragraphs for the top of each digest. Super admin reviews + approves one per week.';
