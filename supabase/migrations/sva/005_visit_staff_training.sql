-- 005_visit_staff_training.sql
-- Track which tagged staff were trained on what during a visit.

ALTER TABLE sva.visit_staff
  ADD COLUMN IF NOT EXISTS was_trained BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS products_trained_on TEXT;

CREATE INDEX IF NOT EXISTS idx_visit_staff_trained
  ON sva.visit_staff(visit_id) WHERE was_trained = true;
