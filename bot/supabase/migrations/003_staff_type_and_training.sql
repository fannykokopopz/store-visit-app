-- Migration 003: Add staff_type, training modules, and visit_notes column
-- Supports the new visit flow (5-section template) and structured training logging

-- ── Staff type enum ─────────────────────────────────────────────────────────

CREATE TYPE staff_type AS ENUM ('staff', 'other_brand', 'part_timer');

ALTER TABLE staff ADD COLUMN staff_type staff_type NOT NULL DEFAULT 'staff';

-- ── Training modules (reference table — products CMs train staff on) ────────

CREATE TABLE training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  brand text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO training_modules (name, brand, sort_order) VALUES
  ('Sonos Voice Control',  'Sonos', 1),
  ('Sonos Ray',            'Sonos', 2),
  ('Sonos Era',            'Sonos', 3),
  ('Sonos Play',           'Sonos', 4),
  ('Willen & Emberton',    'Marshall', 5),
  ('Middleton',            'Marshall', 6)
ON CONFLICT (name) DO NOTHING;

-- ── Visit training logs (which staff trained on which modules per visit) ────

CREATE TABLE visit_training_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visit_id, staff_id, module_id)
);

CREATE INDEX idx_training_logs_visit ON visit_training_logs(visit_id);
CREATE INDEX idx_training_logs_staff ON visit_training_logs(staff_id);

-- ── Visit notes: replace RTEC columns with single notes column ──────────────
-- The new flow accepts one natural message instead of 4 category fields.
-- Keep the old columns for backward compatibility but add the new one.

ALTER TABLE visits ADD COLUMN visit_notes text;

-- ── Ally logging per visit ──────────────────────────────────────────────────

CREATE TABLE visit_ally_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  quarter text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visit_id, staff_id)
);

CREATE INDEX idx_ally_logs_visit ON visit_ally_logs(visit_id);

-- ── RLS for new tables ──────────────────────────────────────────────────────

ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_training_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_ally_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY training_modules_read ON training_modules FOR SELECT
  USING (true);

CREATE POLICY training_logs_via_visit ON visit_training_logs FOR SELECT
  USING (visit_id IN (SELECT id FROM visits WHERE user_id = auth.uid()));

CREATE POLICY ally_logs_via_visit ON visit_ally_logs FOR SELECT
  USING (visit_id IN (SELECT id FROM visits WHERE user_id = auth.uid()));
