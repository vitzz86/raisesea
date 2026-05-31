-- ═══════════════════════════════════════════════════════════════
-- v14_crm_contacts.sql
-- Chunk 10: Fundraising CRM — investors + general contacts pipeline.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.crm_contacts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Core identity
  name              TEXT NOT NULL,
  title             TEXT,
  company           TEXT,
  email             TEXT,
  phone             TEXT,
  linkedin_url      TEXT,
  -- Classification
  contact_type      TEXT NOT NULL,
  board             TEXT NOT NULL CHECK (board IN ('investor','general')),
  stage             TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  is_lost           BOOLEAN NOT NULL DEFAULT false,
  -- Provenance
  met_at_source     TEXT,
  met_at_details    TEXT,
  -- Working notes + next steps
  notes             TEXT,
  next_action       TEXT,
  next_action_date  DATE,
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_contacts_user_idx ON public.crm_contacts (user_id, board, updated_at DESC);

-- updated_at auto-bump trigger
CREATE OR REPLACE FUNCTION public.crm_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crm_contacts_touch ON public.crm_contacts;
CREATE TRIGGER crm_contacts_touch
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.crm_touch_updated_at();

-- RLS: each user only sees their own contacts
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_crm_select" ON public.crm_contacts;
CREATE POLICY "own_crm_select" ON public.crm_contacts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_crm_insert" ON public.crm_contacts;
CREATE POLICY "own_crm_insert" ON public.crm_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_crm_update" ON public.crm_contacts;
CREATE POLICY "own_crm_update" ON public.crm_contacts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_crm_delete" ON public.crm_contacts;
CREATE POLICY "own_crm_delete" ON public.crm_contacts FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.crm_contacts IS 'Per-user CRM: investor pipeline + general contacts (suppliers, partners, etc.)';

-- ─── User-private custom contact types ─────────────────────────────
-- Each user can add their own contact-type labels (e.g. "Sovereign wealth fund").
-- These are private to the user — not shared globally.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS crm_custom_types JSONB DEFAULT '{"investor":[],"general":[]}'::jsonb;

COMMENT ON COLUMN public.user_profiles.crm_custom_types IS 'Per-user custom contact types: {investor: string[], general: string[]}';
