-- TC Acoustic Store Visit App — Initial Schema
-- Shared backend for Telegram bot + web app

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE market AS ENUM ('SG', 'MY', 'TH', 'HK');
CREATE TYPE user_role AS ENUM ('cm', 'manager', 'admin');
CREATE TYPE store_tier AS ENUM ('T1', 'T2', 'T3', 'T4');
CREATE TYPE health_status AS ENUM ('at-risk', 'watch', 'healthy', 'strong');
CREATE TYPE traffic_light AS ENUM ('red', 'amber', 'green');
CREATE TYPE momentum_dir AS ENUM ('up', 'flat', 'down');
CREATE TYPE level AS ENUM ('none', 'low', 'high');
CREATE TYPE relationship_temp AS ENUM ('cold', 'warm', 'strong');
CREATE TYPE visit_quality AS ENUM ('minimal', 'standard', 'thorough');

-- ── Users (TC staff: CMs + managers) ─────────────────────────────────────────

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_chat_id bigint UNIQUE,
  full_name text NOT NULL,
  email text UNIQUE,
  role user_role NOT NULL DEFAULT 'cm',
  market market NOT NULL,
  am_telegram_chat_id bigint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Stores ───────────────────────────────────────────────────────────────────

CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  chain text NOT NULL,
  market market NOT NULL,
  tier store_tier NOT NULL DEFAULT 'T1',
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, market)
);

-- ── CM ↔ Store assignments ───────────────────────────────────────────────────

CREATE TABLE cm_store_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);

-- ── Staff (retail store staff, not TC employees) ─────────────────────────────

CREATE TABLE staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── Staff ↔ Store assignments (handles transfers) ────────────────────────────

CREATE TABLE staff_store_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

-- ── Ally qualifications (append-only, no quarterly reset needed) ─────────────

CREATE TABLE ally_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  quarter text NOT NULL,
  qualified_at timestamptz NOT NULL DEFAULT now(),
  qualified_by_cm_id uuid NOT NULL REFERENCES users(id),
  UNIQUE (staff_id, quarter)
);

-- ── Visits ───────────────────────────────────────────────────────────────────

CREATE TABLE visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,

  -- Raw CM notes per category
  relationship_notes text,
  training_notes text,
  experience_notes text,
  creative_notes text,
  raw_notes_combined text,

  -- AI-extracted fields (NULL until Claude API is connected)
  overall_health health_status,
  stock_status traffic_light,
  stock_summary text,
  skus_at_risk text[],
  momentum momentum_dir,
  momentum_summary text,
  competitor_level level,
  competitor_threats text[],
  training_urgency level,
  training_gaps text[],
  key_insight text,
  recommended_action text,
  staff_relationship relationship_temp,
  visit_quality_rating visit_quality,
  follow_ups text[],

  -- Metadata
  submitted_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  edited_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Visit activities (structured per-activity data) ──────────────────────────

CREATE TABLE visit_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  staff_id uuid REFERENCES staff(id),
  products_mentioned text[],
  ally_qualified boolean,
  engagement_count integer,
  display_quality text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Visit photos ─────────────────────────────────────────────────────────────

CREATE TABLE visit_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text,
  file_size integer,
  caption text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- ── Bot sessions (Telegram conversation state) ───────────────────────────────

CREATE TABLE bot_sessions (
  telegram_chat_id bigint PRIMARY KEY,
  state jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

-- ── Notifications log ────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  recipient_user_id uuid NOT NULL REFERENCES users(id),
  channel text NOT NULL,
  content jsonb NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_visits_store_id ON visits(store_id);
CREATE INDEX idx_visits_user_id ON visits(user_id);
CREATE INDEX idx_visits_visit_date ON visits(visit_date DESC);
CREATE INDEX idx_visits_store_date ON visits(store_id, visit_date DESC);
CREATE INDEX idx_visit_photos_visit_id ON visit_photos(visit_id);
CREATE INDEX idx_visit_activities_visit_id ON visit_activities(visit_id);
CREATE INDEX idx_cm_store_active ON cm_store_assignments(user_id) WHERE is_active = true;
CREATE INDEX idx_staff_store_active ON staff_store_assignments(store_id) WHERE ended_at IS NULL;
CREATE INDEX idx_ally_qual_quarter ON ally_qualifications(staff_id, quarter);
CREATE INDEX idx_users_telegram ON users(telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
CREATE INDEX idx_bot_sessions_expires ON bot_sessions(expires_at);

-- ── RLS Policies (for web app; bot uses service_role and bypasses these) ─────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cm_store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ally_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- CMs see own profile; managers/admins see their market
CREATE POLICY users_own ON users FOR SELECT
  USING (auth.uid() = id);
CREATE POLICY users_market ON users FOR SELECT
  USING (
    market = (SELECT market FROM users WHERE id = auth.uid())
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'admin')
  );

-- Everyone sees stores in their market
CREATE POLICY stores_market ON stores FOR SELECT
  USING (market = (SELECT market FROM users WHERE id = auth.uid()));

-- CMs see/edit own visits; managers see their market
CREATE POLICY visits_own ON visits FOR ALL
  USING (user_id = auth.uid());
CREATE POLICY visits_market_read ON visits FOR SELECT
  USING (
    store_id IN (SELECT id FROM stores WHERE market = (SELECT market FROM users WHERE id = auth.uid()))
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'admin')
  );

-- Visit photos/activities follow their parent visit's access
CREATE POLICY photos_via_visit ON visit_photos FOR SELECT
  USING (visit_id IN (SELECT id FROM visits WHERE user_id = auth.uid()));
CREATE POLICY photos_market ON visit_photos FOR SELECT
  USING (
    visit_id IN (
      SELECT v.id FROM visits v
      JOIN stores s ON s.id = v.store_id
      WHERE s.market = (SELECT market FROM users WHERE id = auth.uid())
    )
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'admin')
  );

CREATE POLICY activities_via_visit ON visit_activities FOR SELECT
  USING (visit_id IN (SELECT id FROM visits WHERE user_id = auth.uid()));

-- CM store assignments visible to the CM and their market managers
CREATE POLICY assignments_own ON cm_store_assignments FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY assignments_market ON cm_store_assignments FOR SELECT
  USING (
    user_id IN (SELECT id FROM users WHERE market = (SELECT market FROM users WHERE id = auth.uid()))
    AND (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'admin')
  );

-- Staff visible to anyone in the same market (via store assignments)
CREATE POLICY staff_market ON staff FOR SELECT
  USING (
    id IN (
      SELECT ssa.staff_id FROM staff_store_assignments ssa
      JOIN stores s ON s.id = ssa.store_id
      WHERE s.market = (SELECT market FROM users WHERE id = auth.uid())
    )
  );

CREATE POLICY staff_stores_market ON staff_store_assignments FOR SELECT
  USING (
    store_id IN (SELECT id FROM stores WHERE market = (SELECT market FROM users WHERE id = auth.uid()))
  );

CREATE POLICY ally_market ON ally_qualifications FOR SELECT
  USING (
    staff_id IN (
      SELECT ssa.staff_id FROM staff_store_assignments ssa
      JOIN stores s ON s.id = ssa.store_id
      WHERE s.market = (SELECT market FROM users WHERE id = auth.uid())
    )
  );

-- Notifications visible only to recipient
CREATE POLICY notifications_own ON notifications FOR SELECT
  USING (recipient_user_id = auth.uid());

-- ── Auto-update updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bot_sessions_updated_at BEFORE UPDATE ON bot_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
