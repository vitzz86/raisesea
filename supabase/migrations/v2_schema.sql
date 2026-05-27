-- ============================================================
-- RaiseSEA v2 Schema Migration
-- Run in Supabase SQL editor
-- ============================================================

-- ── 1. ADD NEW COLUMNS TO submissions ───────────────────────
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS deck_analysis        JSONB,
  ADD COLUMN IF NOT EXISTS market_analysis      JSONB,
  ADD COLUMN IF NOT EXISTS competitive_analysis JSONB,
  ADD COLUMN IF NOT EXISTS sector_profile       JSONB,
  ADD COLUMN IF NOT EXISTS annual_revenue_usd   INTEGER,
  ADD COLUMN IF NOT EXISTS tier                 TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS stripe_session_id    TEXT,
  ADD COLUMN IF NOT EXISTS analysis_status      TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS analysis_error       TEXT;

-- ── 2. INDEXES for faster queries ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_submissions_tier
  ON submissions(tier);
CREATE INDEX IF NOT EXISTS idx_submissions_status
  ON submissions(analysis_status);
CREATE INDEX IF NOT EXISTS idx_submissions_sector
  ON submissions((sector_profile->>'primary_sector'));

-- ── 3. MEET PROFILES ─────────────────────────────────────────
-- Expanded beyond investors: VCs, angels, industry experts,
-- tech experts, advisors, mentors, corporate innovation leads

CREATE TABLE IF NOT EXISTS meet_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- Identity
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  photo_url       TEXT,
  linkedin_url    TEXT,
  website_url     TEXT,

  -- Profile type (expanded beyond investors)
  profile_type    TEXT NOT NULL CHECK (profile_type IN (
    'investor_vc',
    'investor_angel',
    'investor_cvc',
    'industry_expert',
    'tech_expert',
    'startup_advisor',
    'mentor',
    'corporate_innovation',
    'former_founder'
  )),

  -- Role details
  title           TEXT NOT NULL,    -- e.g. "Partner", "CTO", "Industry Expert"
  organisation    TEXT NOT NULL,    -- e.g. "Wavemaker Partners", "Petronas", "Freelance"
  bio             TEXT,

  -- Focus areas (for matching)
  focus_sectors   TEXT[],          -- ['AI/ML', 'Fintech', 'O&G']
  focus_stages    TEXT[],          -- ['Pre-seed', 'Seed', 'Series A'] — for investors
  countries       TEXT[],          -- ['MY', 'ID', 'SG']
  expertise_tags  TEXT[],          -- ['Computer Vision', 'Oil & Gas', 'B2B Sales']

  -- For investors only (nullable for others)
  ticket_min_usd  INTEGER,
  ticket_max_usd  INTEGER,
  fund_name       TEXT,

  -- Availability
  what_i_offer    TEXT,            -- "I can help with..." free text
  meeting_format  TEXT DEFAULT '30-min video call',
  timezone        TEXT DEFAULT 'Asia/Kuala_Lumpur',
  response_days   INTEGER DEFAULT 2,  -- typical days to respond

  -- Platform state
  is_active       BOOLEAN DEFAULT false,  -- admin must approve
  is_featured     BOOLEAN DEFAULT false,
  total_meetings  INTEGER DEFAULT 0,
  response_rate   NUMERIC(4,1),          -- computed periodically

  -- Stats (for response rate badge)
  meetings_accepted INTEGER DEFAULT 0,
  meetings_declined INTEGER DEFAULT 0,
  meetings_pending  INTEGER DEFAULT 0
);

-- ── 4. AVAILABILITY SLOTS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS availability_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES meet_profiles(id) ON DELETE CASCADE,
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  timezone        TEXT DEFAULT 'Asia/Kuala_Lumpur',
  is_recurring    BOOLEAN DEFAULT true,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slots_profile ON availability_slots(profile_id);
CREATE INDEX IF NOT EXISTS idx_slots_day ON availability_slots(day_of_week);

-- ── 5. MEETING REQUESTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- Who
  profile_id      UUID NOT NULL REFERENCES meet_profiles(id) ON DELETE CASCADE,
  submission_id   UUID REFERENCES submissions(id) ON DELETE SET NULL,  -- optional (post-match flow)

  -- Founder info (no login required for founders)
  founder_name    TEXT NOT NULL,
  founder_email   TEXT NOT NULL,
  company_name    TEXT NOT NULL,
  company_url     TEXT,
  pitch_text      TEXT NOT NULL,  -- 3-line pitch
  deck_url        TEXT,           -- shared if they consent

  -- Slot requested
  preferred_slot_id UUID REFERENCES availability_slots(id),
  preferred_date  DATE,
  preferred_time  TIME,

  -- Status flow: pending → accepted | declined | cancelled
  status          TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'declined', 'cancelled', 'completed'
  )),

  -- Accept/decline
  accepted_at     TIMESTAMPTZ,
  declined_at     TIMESTAMPTZ,
  decline_reason  TEXT,
  video_link      TEXT,          -- set when accepted
  calendar_ics    TEXT,          -- base64 .ics content

  -- Match context (if coming from investor matching)
  match_score     INTEGER,
  from_match      BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_meetings_profile ON meeting_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_meetings_status  ON meeting_requests(status);
CREATE INDEX IF NOT EXISTS idx_meetings_founder ON meeting_requests(founder_email);

-- ── 6. RLS POLICIES ─────────────────────────────────────────
ALTER TABLE meet_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;

-- Meet profiles: anyone can read active profiles
CREATE POLICY "Public can view active meet profiles"
  ON meet_profiles FOR SELECT
  USING (is_active = true);

-- Availability slots: anyone can read slots for active profiles
CREATE POLICY "Public can view availability slots"
  ON availability_slots FOR SELECT
  USING (is_active = true);

-- Meeting requests: service role only (we use service key in API routes)
CREATE POLICY "Service role manages meetings"
  ON meeting_requests FOR ALL
  USING (auth.role() = 'service_role');

-- ── 7. HELPER FUNCTION: compute response rate ────────────────
CREATE OR REPLACE FUNCTION update_profile_response_rate()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE meet_profiles
  SET
    meetings_accepted = (SELECT COUNT(*) FROM meeting_requests WHERE profile_id = NEW.profile_id AND status = 'accepted'),
    meetings_declined = (SELECT COUNT(*) FROM meeting_requests WHERE profile_id = NEW.profile_id AND status = 'declined'),
    total_meetings    = (SELECT COUNT(*) FROM meeting_requests WHERE profile_id = NEW.profile_id),
    response_rate     = CASE
      WHEN (SELECT COUNT(*) FROM meeting_requests WHERE profile_id = NEW.profile_id AND status != 'pending') > 0
      THEN ROUND(
        (SELECT COUNT(*) FROM meeting_requests WHERE profile_id = NEW.profile_id AND status = 'accepted')::NUMERIC /
        (SELECT COUNT(*) FROM meeting_requests WHERE profile_id = NEW.profile_id AND status != 'pending')::NUMERIC * 100,
        1
      )
      ELSE NULL
    END,
    updated_at = now()
  WHERE id = NEW.profile_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_response_rate
  AFTER INSERT OR UPDATE ON meeting_requests
  FOR EACH ROW EXECUTE FUNCTION update_profile_response_rate();

-- ── 8. SUBMISSION INTELLIGENCE (learning flywheel) ───────────
CREATE TABLE IF NOT EXISTS submission_intelligence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  submission_id   UUID REFERENCES submissions(id) ON DELETE CASCADE,

  -- Anonymized data points for benchmark enrichment
  sector          TEXT,
  sub_sectors     TEXT[],
  stage           TEXT,
  country         TEXT,
  raise_target_usd INTEGER,
  deck_score      INTEGER,
  deck_scores_by_dimension JSONB,
  missing_slides  TEXT[],
  moat_score      NUMERIC(3,1),
  market_methodology TEXT,  -- top-down, bottom-up, missing
  revenue_type    TEXT,

  -- Outcome (founder self-reports later)
  raised_outcome  TEXT,     -- 'yes', 'no', null
  raised_amount   INTEGER,
  raised_premoney INTEGER,

  contributed_to_db BOOLEAN DEFAULT false
);

-- Done
SELECT 'RaiseSEA v2 schema migration complete' AS status;
