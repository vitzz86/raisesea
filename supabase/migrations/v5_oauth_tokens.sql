-- ═══════════════════════════════════════════════════════════════
-- v5_oauth_tokens.sql
-- Encrypted storage for OAuth refresh tokens. Used by chunk 7 when
-- VCs connect their Google Calendar. We store refresh tokens
-- encrypted at rest using pgsodium so a DB leak doesn't expose
-- credentials.
--
-- Why this exists: our previous Drive integration failed with
-- "invalid_grant" because tokens weren't refreshed properly.
-- This table is the foundation for never having that problem again.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL,                      -- 'google_calendar' (more providers later)
  -- The refresh token is stored encrypted via pgsodium.
  -- We use TEXT (base64) rather than BYTEA so it's easy to debug/migrate.
  encrypted_token      TEXT NOT NULL,
  token_nonce          TEXT NOT NULL,                      -- pgsodium needs a nonce per encryption
  scope                TEXT,                               -- granted OAuth scopes
  expires_at           TIMESTAMPTZ,                        -- when the access token (not refresh) expires
  last_refreshed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status               TEXT NOT NULL DEFAULT 'active',     -- 'active' | 'revoked' | 'expired'
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS oauth_tokens_user_provider_idx
  ON public.oauth_tokens (user_id, provider) WHERE status = 'active';

-- ── Encryption helpers ─────────────────────────────────────────
-- We store the encryption key in pgsodium's key management system
-- on first use, then reference it by ID.

-- Create the key once (idempotent — returns existing if already created)
CREATE OR REPLACE FUNCTION public.ensure_oauth_key()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_key_id UUID;
BEGIN
  SELECT id INTO v_key_id FROM pgsodium.key WHERE name = 'oauth_tokens_key' LIMIT 1;
  IF v_key_id IS NULL THEN
    SELECT id INTO v_key_id FROM pgsodium.create_key(name := 'oauth_tokens_key');
  END IF;
  RETURN v_key_id;
END;
$$;

-- Encrypt and insert/update a refresh token (UPSERT on user_id+provider)
CREATE OR REPLACE FUNCTION public.set_oauth_token(
  p_user_id   UUID,
  p_provider  TEXT,
  p_token     TEXT,
  p_scope     TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_key_id   UUID;
  v_nonce    BYTEA;
  v_enc      BYTEA;
  v_id       UUID;
BEGIN
  v_key_id := public.ensure_oauth_key();
  v_nonce  := pgsodium.crypto_aead_det_noncegen();
  v_enc    := pgsodium.crypto_aead_det_encrypt(
                convert_to(p_token, 'utf8'),
                convert_to(p_user_id::text || ':' || p_provider, 'utf8'),
                v_key_id,
                v_nonce
              );

  INSERT INTO public.oauth_tokens (
    user_id, provider, encrypted_token, token_nonce, scope, expires_at, last_refreshed_at, status
  ) VALUES (
    p_user_id, p_provider, encode(v_enc, 'base64'), encode(v_nonce, 'base64'),
    p_scope, p_expires_at, NOW(), 'active'
  )
  ON CONFLICT (user_id, provider) DO UPDATE SET
    encrypted_token = EXCLUDED.encrypted_token,
    token_nonce     = EXCLUDED.token_nonce,
    scope           = EXCLUDED.scope,
    expires_at      = EXCLUDED.expires_at,
    last_refreshed_at = NOW(),
    status          = 'active'
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Decrypt and return a refresh token
CREATE OR REPLACE FUNCTION public.get_oauth_token(
  p_user_id  UUID,
  p_provider TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgsodium
AS $$
DECLARE
  v_key_id  UUID;
  v_enc     BYTEA;
  v_nonce   BYTEA;
  v_dec     BYTEA;
BEGIN
  v_key_id := public.ensure_oauth_key();

  SELECT decode(encrypted_token, 'base64'), decode(token_nonce, 'base64')
  INTO v_enc, v_nonce
  FROM public.oauth_tokens
  WHERE user_id = p_user_id AND provider = p_provider AND status = 'active'
  LIMIT 1;

  IF v_enc IS NULL THEN
    RETURN NULL;
  END IF;

  v_dec := pgsodium.crypto_aead_det_decrypt(
             v_enc,
             convert_to(p_user_id::text || ':' || p_provider, 'utf8'),
             v_key_id,
             v_nonce
           );

  RETURN convert_from(v_dec, 'utf8');
END;
$$;

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.oauth_tokens;

-- Only service role can read/write — never expose tokens to clients
CREATE POLICY "Service role only"
  ON public.oauth_tokens FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.oauth_tokens IS
  'Encrypted OAuth refresh tokens (currently google_calendar). pgsodium-encrypted at rest.';
