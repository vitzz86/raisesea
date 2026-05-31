-- ═══════════════════════════════════════════════════════════════
-- v9_meeting_requests_polish.sql
-- Chunk 7 fix: add vc_responded_at to track when the expert
-- accepted/declined. Original v6 schema missed this column.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.meeting_requests
  ADD COLUMN IF NOT EXISTS vc_responded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.meeting_requests.vc_responded_at
  IS 'Set to NOW() when VC accepts or declines. NULL while still pending.';
