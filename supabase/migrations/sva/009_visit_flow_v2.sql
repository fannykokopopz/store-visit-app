-- 009_visit_flow_v2.sql
-- Visit flow v2: add people_training freetext, structured follow-ups table,
-- and photo section tagging.

-- ─── 4.1 Add people_training column ──────────────────────────────────────────
-- Merges James's prompts 2 (People) and 3 (Training) into one freetext field.
-- Structured trainings continue to use sva.visit_staff_training (mini-app entry).

ALTER TABLE sva.visits
  ADD COLUMN IF NOT EXISTS people_training text;

-- Legacy columns kept nullable so old visits render fine:
--   good_news, competitors, display_stock, follow_up, buzz_plan, training
-- New flow writes:
--   good_news              ← Good News prompt
--   people_training        ← People & Training prompt (NEW)
--   competitors            ← Competitor Insights prompt (reuse column, relabel in UI)
--   display_stock          ← Display & Stock prompt (absorbs buzz mentions via copy)
--   follow_up              ← freetext follow-up fallback (typed at close-out)
-- New flow does NOT write to:
--   buzz_plan, training, grade, grade_comments

-- ─── 4.2 Structured follow-ups ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sva.visit_follow_ups (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id            uuid        NOT NULL REFERENCES sva.visits(id) ON DELETE CASCADE,
  store_id            uuid        NOT NULL REFERENCES sva.stores(id),
  cm_telegram_id      bigint      NOT NULL,
  title               text        NOT NULL,
  notes               text,
  due_date            date,
  status              text        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open','done','cancelled')),
  closed_at           timestamptz,
  closed_by_visit_id  uuid        REFERENCES sva.visits(id),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_visit ON sva.visit_follow_ups(visit_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_store_open
  ON sva.visit_follow_ups(store_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_follow_ups_cm_open
  ON sva.visit_follow_ups(cm_telegram_id) WHERE status = 'open';

-- ─── 4.3 Photo section tagging ───────────────────────────────────────────────

ALTER TABLE sva.visit_photos
  ADD COLUMN IF NOT EXISTS section_key text;

-- Allowed values (validated app-side, not DB-side to keep migration cheap):
--   'good_news' | 'people_training' | 'competitor' | 'display_stock' | 'follow_up' | NULL
-- NULL = photo arrived before any prompt was active (e.g., during store-pick).
-- The legacy photo_tag column stays untouched (auto-tag AI may still use it later).

CREATE INDEX IF NOT EXISTS idx_photos_visit_section
  ON sva.visit_photos(visit_id, section_key);
