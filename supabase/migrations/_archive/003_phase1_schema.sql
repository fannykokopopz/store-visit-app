-- Phase 1: New visit sections, lock, staff roster, visit plans

-- Extend role enum for future roles (not built yet)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cmic';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'am';

-- New 5-section columns on visits + lock
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS good_news text,
  ADD COLUMN IF NOT EXISTS competitors text,
  ADD COLUMN IF NOT EXISTS display_stock text,
  ADD COLUMN IF NOT EXISTS follow_up text,
  ADD COLUMN IF NOT EXISTS buzz_plan text,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

-- Staff: add store FK, role, ally fields
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id),
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS is_ally boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ally_since timestamptz;

-- Who was working during a visit
CREATE TABLE IF NOT EXISTS visit_staff (
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  PRIMARY KEY (visit_id, staff_id)
);

-- Pre-visit intent: who to train, what buzz to run
CREATE TABLE IF NOT EXISTS visit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cm_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  planned_date date,
  buzz_plan text,
  notes text,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_staff_visit ON visit_staff(visit_id);
CREATE INDEX IF NOT EXISTS idx_staff_store ON staff(store_id) WHERE store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_visit_plans_active ON visit_plans(cm_id, store_id) WHERE consumed_at IS NULL;
