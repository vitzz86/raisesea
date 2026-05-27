-- ═══════════════════════════════════════════════════════════════
-- v6_meetings_and_news.sql
-- Schema for chunks 6 (VC self-signup), 7 (meeting requests), 8 (news).
-- Creating now so foreign keys and indexes are in place before code lands.
-- ═══════════════════════════════════════════════════════════════

-- ───── VC self-onboarded profiles ───────────────────────────────
-- Distinct from the existing `investors` table which is YOUR curated DB.
-- vc_profiles = VCs who self-registered via /vc/register (chunk 6).
-- They may or may not match an existing investors row.
CREATE TABLE IF NOT EXISTS public.vc_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id         UUID REFERENCES public.investors(id) ON DELETE SET NULL,   -- link to curated row if exists
  profile_type        TEXT NOT NULL DEFAULT 'vc',           -- 'vc' | 'angel' | 'expert' | 'advisor' | 'mentor'
  display_name        TEXT NOT NULL,
  fund_or_firm        TEXT,
  title               TEXT,
  bio                 TEXT,
  linkedin_url        TEXT,
  website             TEXT,
  hq_country          TEXT,
  hq_city             TEXT,
  invest_stages       TEXT[] DEFAULT '{}',                  -- ['Seed', 'Pre-series A', ...]
  invest_sectors      TEXT[] DEFAULT '{}',                  -- ['SaaS', 'Fintech', ...]
  ticket_min_usd      BIGINT,
  ticket_max_usd      BIGINT,
  investment_thesis   TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_listed           BOOLEAN NOT NULL DEFAULT FALSE,       -- founder-visible in directory
  meeting_mode        TEXT NOT NULL DEFAULT 'review',       -- 'review' (always manual review) — locked per your decision
  calendar_connected  BOOLEAN NOT NULL DEFAULT FALSE,       -- has linked Google Calendar
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vc_profiles_user_idx     ON public.vc_profiles (user_id);
CREATE INDEX IF NOT EXISTS vc_profiles_listed_idx   ON public.vc_profiles (is_listed) WHERE is_listed = TRUE;
CREATE INDEX IF NOT EXISTS vc_profiles_stages_idx   ON public.vc_profiles USING GIN (invest_stages);
CREATE INDEX IF NOT EXISTS vc_profiles_sectors_idx  ON public.vc_profiles USING GIN (invest_sectors);

DROP TRIGGER IF EXISTS vc_profiles_set_updated_at ON public.vc_profiles;
CREATE TRIGGER vc_profiles_set_updated_at
  BEFORE UPDATE ON public.vc_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ───── VC declared availability ─────────────────────────────────
-- The weekly recurring time windows where founders can request meetings.
-- Example: Tue 10:00-12:00 + Tue 14:00-17:00 + Thu 09:00-11:00.
-- Founders pick from `(declared availability) - (Google Calendar busy times)`.
CREATE TABLE IF NOT EXISTS public.vc_availability (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vc_profile_id       UUID NOT NULL REFERENCES public.vc_profiles(id) ON DELETE CASCADE,
  day_of_week         INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun..6=Sat
  start_time          TIME NOT NULL,
  end_time            TIME NOT NULL,
  timezone            TEXT NOT NULL DEFAULT 'Asia/Singapore',
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS vc_availability_vc_idx
  ON public.vc_availability (vc_profile_id) WHERE is_active = TRUE;


-- ───── Meeting requests (Job Application model) ─────────────────
CREATE TABLE IF NOT EXISTS public.meeting_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vc_profile_id           UUID NOT NULL REFERENCES public.vc_profiles(id) ON DELETE CASCADE,
  submission_id           UUID REFERENCES public.submissions(id) ON DELETE SET NULL,
  -- Founder's submitted "application"
  meeting_goal            TEXT NOT NULL,                    -- short purpose: 'pitch_intro' | 'feedback' | 'investment_discussion'
  meeting_notes           TEXT,                             -- founder's free-text context
  key_questions           TEXT[],                           -- 3-5 things to discuss
  deck_storage_path       TEXT,                             -- pitch-decks/<user_id>/<slug>.pdf
  -- Founder's 3 preferred slots (UTC ISO timestamps)
  preferred_slot_1        TIMESTAMPTZ NOT NULL,
  preferred_slot_2        TIMESTAMPTZ,
  preferred_slot_3        TIMESTAMPTZ,
  -- Status lifecycle
  status                  TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' = waiting for VC review
  -- 'confirmed' = VC accepted, Calendar event created
  -- 'declined' = VC declined
  -- 'expired' = auto-expired (soft-hold ran out or 1h before meeting)
  -- 'cancelled' = either party cancelled after confirmation
  -- 'completed' = past meeting that happened
  vc_response             TEXT,                             -- VC's optional decline reason / propose message
  confirmed_slot          TIMESTAMPTZ,                      -- which of the 3 the VC picked
  google_calendar_event_id TEXT,                            -- once confirmed
  google_meet_link        TEXT,                             -- once confirmed
  -- Soft-hold expiry: min(7 days, 1h-before-earliest-slot) per your spec
  soft_hold_expires_at    TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expired_at              TIMESTAMPTZ,
  -- After auto-expire, we email the VC immediately with a "you missed this" link
  grace_email_sent_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS meeting_requests_founder_idx  ON public.meeting_requests (founder_user_id);
CREATE INDEX IF NOT EXISTS meeting_requests_vc_idx       ON public.meeting_requests (vc_profile_id);
CREATE INDEX IF NOT EXISTS meeting_requests_status_idx   ON public.meeting_requests (status);
CREATE INDEX IF NOT EXISTS meeting_requests_expiry_idx
  ON public.meeting_requests (soft_hold_expires_at) WHERE status = 'pending';

DROP TRIGGER IF EXISTS meeting_requests_set_updated_at ON public.meeting_requests;
CREATE TRIGGER meeting_requests_set_updated_at
  BEFORE UPDATE ON public.meeting_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ───── News articles (chunk 8) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.news_articles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source             TEXT NOT NULL,                          -- 'TechInAsia' | 'e27' | 'DealStreetAsia' | ...
  source_url         TEXT UNIQUE NOT NULL,
  title              TEXT NOT NULL,
  summary            TEXT,                                   -- Gemini-generated 2-3 sentence summary
  raw_text           TEXT,                                   -- truncated full text for re-classification
  category           TEXT NOT NULL,                          -- 'fundraising' | 'tech' | 'economic_policy' | 'exit_market'
  sub_category       TEXT,                                   -- e.g. 'Series A', 'M&A', 'regulation'
  sectors            TEXT[] DEFAULT '{}',                    -- ['SaaS', 'Fintech', ...]
  stage              TEXT,                                   -- if category = fundraising
  countries          TEXT[] DEFAULT '{}',                    -- ['ID', 'SG', ...]
  region             TEXT NOT NULL DEFAULT 'SEA',            -- 'SEA' | 'Global'
  companies_mentioned TEXT[] DEFAULT '{}',
  investors_mentioned TEXT[] DEFAULT '{}',
  published_at       TIMESTAMPTZ,
  fetched_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  classification_confidence NUMERIC                          -- 0-1 from Gemini
);

CREATE INDEX IF NOT EXISTS news_published_idx  ON public.news_articles (published_at DESC);
CREATE INDEX IF NOT EXISTS news_category_idx   ON public.news_articles (category, published_at DESC);
CREATE INDEX IF NOT EXISTS news_sectors_idx    ON public.news_articles USING GIN (sectors);
CREATE INDEX IF NOT EXISTS news_countries_idx  ON public.news_articles USING GIN (countries);


-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.vc_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vc_availability    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_articles      ENABLE ROW LEVEL SECURITY;

-- vc_profiles
DROP POLICY IF EXISTS "Listed VCs are publicly viewable" ON public.vc_profiles;
DROP POLICY IF EXISTS "VCs manage own profile"           ON public.vc_profiles;
DROP POLICY IF EXISTS "Service role full access"         ON public.vc_profiles;

CREATE POLICY "Listed VCs are publicly viewable"
  ON public.vc_profiles FOR SELECT
  USING (is_listed = TRUE AND is_active = TRUE);
CREATE POLICY "VCs manage own profile"
  ON public.vc_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access"
  ON public.vc_profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- vc_availability
DROP POLICY IF EXISTS "VCs manage own availability" ON public.vc_availability;
DROP POLICY IF EXISTS "Anyone views listed availability" ON public.vc_availability;
DROP POLICY IF EXISTS "Service role full access" ON public.vc_availability;

CREATE POLICY "VCs manage own availability"
  ON public.vc_availability FOR ALL
  USING (vc_profile_id IN (SELECT id FROM public.vc_profiles WHERE user_id = auth.uid()))
  WITH CHECK (vc_profile_id IN (SELECT id FROM public.vc_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Anyone views listed availability"
  ON public.vc_availability FOR SELECT
  USING (vc_profile_id IN (SELECT id FROM public.vc_profiles WHERE is_listed = TRUE));
CREATE POLICY "Service role full access"
  ON public.vc_availability FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- meeting_requests — only the founder + the VC involved can see/modify
DROP POLICY IF EXISTS "Founder views own requests"  ON public.meeting_requests;
DROP POLICY IF EXISTS "VC views received requests"  ON public.meeting_requests;
DROP POLICY IF EXISTS "Founder creates own request" ON public.meeting_requests;
DROP POLICY IF EXISTS "Service role full access"    ON public.meeting_requests;

CREATE POLICY "Founder views own requests"
  ON public.meeting_requests FOR SELECT
  USING (founder_user_id = auth.uid());
CREATE POLICY "VC views received requests"
  ON public.meeting_requests FOR SELECT
  USING (vc_profile_id IN (SELECT id FROM public.vc_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Founder creates own request"
  ON public.meeting_requests FOR INSERT
  WITH CHECK (founder_user_id = auth.uid());
CREATE POLICY "Service role full access"
  ON public.meeting_requests FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- news_articles — readable by any authenticated user
DROP POLICY IF EXISTS "Authenticated reads news" ON public.news_articles;
DROP POLICY IF EXISTS "Service role writes news" ON public.news_articles;

CREATE POLICY "Authenticated reads news"
  ON public.news_articles FOR SELECT
  USING (auth.role() = 'authenticated');
CREATE POLICY "Service role writes news"
  ON public.news_articles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.vc_profiles      IS 'Self-onboarded VC/expert/mentor profiles for the meeting marketplace (chunk 6).';
COMMENT ON TABLE public.meeting_requests IS 'Founder→VC meeting requests, Job Application model. See chunk 7.';
COMMENT ON TABLE public.news_articles    IS 'Daily cron-fetched + Gemini-classified articles. See chunk 8.';
