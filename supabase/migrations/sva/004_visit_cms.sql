-- 004_visit_cms.sql
-- Multi-CM tagging per visit. visits.cm_telegram_id stays as the lead/submitter;
-- visit_cms holds the full set (lead + co). Existing visits are backfilled as lead.

CREATE TABLE IF NOT EXISTS sva.visit_cms (
  visit_id        uuid        NOT NULL REFERENCES sva.visits(id) ON DELETE CASCADE,
  cm_telegram_id  bigint      NOT NULL REFERENCES sva.cms(telegram_id) ON DELETE CASCADE,
  role            text        NOT NULL DEFAULT 'co' CHECK (role IN ('lead', 'co')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_id, cm_telegram_id)
);

CREATE INDEX IF NOT EXISTS idx_visit_cms_cm ON sva.visit_cms(cm_telegram_id);

INSERT INTO sva.visit_cms (visit_id, cm_telegram_id, role)
SELECT id, cm_telegram_id, 'lead'
FROM sva.visits
WHERE cm_telegram_id IS NOT NULL
ON CONFLICT DO NOTHING;
