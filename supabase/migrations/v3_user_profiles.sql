-- ═══════════════════════════════════════════════════════════════
-- v3_user_profiles.sql
-- Creates the user_profiles table that mirrors auth.users with
-- additional founder-facing fields. Auto-created via trigger when
-- a new user signs up (magic link or Google OAuth).
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT UNIQUE NOT NULL,
  full_name       TEXT,
  company_name    TEXT,
  country         TEXT,                            -- SEA country: SG, ID, MY, VN, PH, TH
  role            TEXT NOT NULL DEFAULT 'founder', -- 'founder' | 'vc' | 'expert' (vc/expert in chunk 6)
  plan            TEXT NOT NULL DEFAULT 'free',    -- 'free' | 'pro' | 'institutional' (post-MVP)
  news_sectors    TEXT[] DEFAULT '{}',             -- filters for news digest (chunk 8)
  submissions_count INTEGER NOT NULL DEFAULT 0,    -- denormalized for dashboard stats
  onboarded_at    TIMESTAMPTZ,                     -- null until they complete onboarding
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON public.user_profiles (email);
CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON public.user_profiles (role);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create user_profiles row when a new auth.users row is inserted.
-- Pulls metadata from Google OAuth (full_name) and magic link (just email).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      ''
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── RLS policies ────────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotent re-runs)
DROP POLICY IF EXISTS "Users can view own profile"   ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Service role full access"     ON public.user_profiles;

-- Users can only see and edit their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role (API routes) has full access
CREATE POLICY "Service role full access"
  ON public.user_profiles FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.user_profiles IS
  'Founder/VC/expert profile data, 1:1 with auth.users. Auto-created via on_auth_user_created trigger.';
