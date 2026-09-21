-- Retire the legacy approval queue after moving ingestion to publish-or-skip.
-- Pending rows were never public, so preserving them as rejected keeps the
-- audit trail without accidentally publishing records that failed old gates.

UPDATE public.news_items
SET
  status = 'rejected',
  reject_reason = COALESCE(reject_reason, review_reason, 'legacy_pending_retired')
WHERE status = 'pending';

COMMENT ON COLUMN public.news_items.status
  IS 'approved = publicly listed; rejected = skipped or operator-delisted. New automated ingestion never creates pending rows.';

COMMENT ON COLUMN public.news_items.review_reason
  IS 'Automatic publish-or-skip reason retained for audit; no manual approval queue depends on this field.';
