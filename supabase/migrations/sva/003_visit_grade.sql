-- Migration 003: per-visit grade (1–3) + free-text comments
-- See PLAN-2026-05-15-ricky-easy-wins.md §2.2

ALTER TABLE sva.visits
  ADD COLUMN IF NOT EXISTS grade SMALLINT CHECK (grade BETWEEN 1 AND 3),
  ADD COLUMN IF NOT EXISTS grade_comments TEXT;

CREATE INDEX IF NOT EXISTS idx_visits_grade ON sva.visits(grade) WHERE grade IS NOT NULL;
