-- Concurrency-safe limits for expensive authenticated API operations.
-- Apply this migration before deploying code that calls consume_api_rate_limit.

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  principal_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (principal_id, action, window_started_at)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.api_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
  p_principal_id UUID,
  p_action TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF p_principal_id IS NULL
    OR p_action IS NULL
    OR char_length(p_action) NOT BETWEEN 1 AND 80
    OR p_max_requests NOT BETWEEN 1 AND 10000
    OR p_window_seconds NOT BETWEEN 1 AND 86400
  THEN
    RAISE EXCEPTION 'Invalid rate-limit arguments';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.api_rate_limits (
    principal_id,
    action,
    window_started_at,
    request_count
  )
  VALUES (p_principal_id, p_action, v_window_start, 1)
  ON CONFLICT (principal_id, action, window_started_at)
  DO UPDATE SET request_count = public.api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  DELETE FROM public.api_rate_limits
  WHERE principal_id = p_principal_id
    AND action = p_action
    AND window_started_at < v_now - INTERVAL '2 days';

  RETURN QUERY SELECT
    v_count <= p_max_requests,
    greatest(p_max_requests - v_count, 0),
    v_window_start + make_interval(secs => p_window_seconds);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(UUID, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(UUID, TEXT, INTEGER, INTEGER)
  TO service_role;

COMMENT ON TABLE public.api_rate_limits IS
  'Fixed-window counters for authenticated, resource-intensive API operations.';
