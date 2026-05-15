-- 006_cm_join_requests.sql
-- Track pending join requests inline on sva.cms.
-- A pending row has is_active=false AND pending_request_at IS NOT NULL.
-- Approval flips is_active=true and clears pending_request_at.
-- Rejection deletes the row.

ALTER TABLE sva.cms
  ADD COLUMN IF NOT EXISTS pending_request_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cms_pending
  ON sva.cms(pending_request_at) WHERE pending_request_at IS NOT NULL;
