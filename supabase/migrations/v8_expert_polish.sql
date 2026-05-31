-- ═══════════════════════════════════════════════════════════════
-- v8_expert_polish.sql
-- Chunk 6.5 — Avatar, company links, expanded expertise.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.vc_profiles
  ADD COLUMN IF NOT EXISTS avatar_url           TEXT,
  ADD COLUMN IF NOT EXISTS company_website      TEXT,
  ADD COLUMN IF NOT EXISTS company_linkedin_url TEXT;

COMMENT ON COLUMN public.vc_profiles.avatar_url           IS 'Public URL to profile photo in expert-avatars Storage bucket (null = use initial letter)';
COMMENT ON COLUMN public.vc_profiles.company_website      IS 'Company website (separate from personal website)';
COMMENT ON COLUMN public.vc_profiles.company_linkedin_url IS 'Company LinkedIn company-page URL (separate from personal LinkedIn)';
