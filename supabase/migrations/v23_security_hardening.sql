-- RaiseSEA v23: emergency database permission + submission privacy hardening.
-- Run after v22_incubator_unpad_workspace.sql.

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Every
-- SECURITY DEFINER function below bypasses RLS, so only the service role may
-- invoke it through PostgREST.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

REVOKE ALL ON FUNCTION public.claim_submissions_by_email(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_platform_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_pending_experts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_oauth_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_oauth_token(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_oauth_token(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_submissions_by_email(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.count_pending_experts() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_oauth_key() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_oauth_token(UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_oauth_token(UUID, TEXT) TO service_role;

-- A row-level policy cannot enforce "only when queried by slug". It allowed an
-- anonymous REST client to enumerate every public row and every column. Public
-- shared reports are now loaded server-side after slug + visibility checks.
DROP POLICY IF EXISTS "Public can view by slug" ON public.submissions;
DROP POLICY IF EXISTS "Public can view if is_public" ON public.submissions;

-- Owners retain direct access under the existing owner policy. Server routes
-- and server components use the service role after explicit authorization.
