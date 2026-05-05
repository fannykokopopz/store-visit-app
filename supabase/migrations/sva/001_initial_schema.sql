-- SVA schema: all TC Store Visit App tables
-- Runs alongside CultivAIte in public schema — nothing here touches public.*
-- Identity: telegram_id (bigint). Service role only, no RLS, no Supabase Auth.

CREATE SCHEMA IF NOT EXISTS sva;

-- ─── Trigger helper ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sva.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── Users (CM allowlist) ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sva.cms (
  telegram_id       bigint      PRIMARY KEY,
  full_name         text        NOT NULL,
  role              text        NOT NULL DEFAULT 'cm'
                                CHECK (role IN ('cm', 'cmic', 'am', 'admin')),
  market            text        NOT NULL DEFAULT 'SG'
                                CHECK (market IN ('SG', 'TH', 'MY', 'HK')),
  am_telegram_id    bigint      REFERENCES sva.cms(telegram_id) ON DELETE SET NULL,
  is_active         boolean     NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER cms_updated_at
  BEFORE UPDATE ON sva.cms
  FOR EACH ROW EXECUTE FUNCTION sva.update_updated_at();

-- ─── Stores ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sva.stores (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  chain       text        NOT NULL,
  market      text        NOT NULL CHECK (market IN ('SG', 'TH', 'MY', 'HK')),
  tier        text        CHECK (tier IN ('T1', 'T2', 'T3', 'T4')),
  address     text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, market)
);

CREATE INDEX IF NOT EXISTS idx_stores_market ON sva.stores(market);
CREATE INDEX IF NOT EXISTS idx_stores_chain  ON sva.stores(chain);

CREATE TRIGGER stores_updated_at
  BEFORE UPDATE ON sva.stores
  FOR EACH ROW EXECUTE FUNCTION sva.update_updated_at();

-- ─── CM → Store assignments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sva.cm_store_assignments (
  cm_telegram_id  bigint      NOT NULL REFERENCES sva.cms(telegram_id)   ON DELETE CASCADE,
  store_id        uuid        NOT NULL REFERENCES sva.stores(id)          ON DELETE CASCADE,
  is_active       boolean     NOT NULL DEFAULT true,
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cm_telegram_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_csa_store ON sva.cm_store_assignments(store_id);

-- ─── Store staff ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sva.staff (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES sva.stores(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  role        text,
  phone       text,
  is_ally     boolean     NOT NULL DEFAULT false,
  ally_since  timestamptz,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_store ON sva.staff(store_id);

CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON sva.staff
  FOR EACH ROW EXECUTE FUNCTION sva.update_updated_at();

-- ─── Visits ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sva.visits (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid        NOT NULL REFERENCES sva.stores(id)  ON DELETE RESTRICT,
  cm_telegram_id  bigint      NOT NULL REFERENCES sva.cms(telegram_id) ON DELETE RESTRICT,
  visit_date      date        NOT NULL DEFAULT CURRENT_DATE,
  -- 5 visit sections
  good_news       text,
  competitors     text,
  display_stock   text,
  follow_up       text,
  buzz_plan       text,
  -- state
  is_locked       boolean     NOT NULL DEFAULT false,
  locked_at       timestamptz,
  submitted_at    timestamptz,
  edited_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_store_date ON sva.visits(store_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_cm_date    ON sva.visits(cm_telegram_id, visit_date DESC);

-- ─── Visit ↔ Staff junction ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sva.visit_staff (
  visit_id  uuid NOT NULL REFERENCES sva.visits(id) ON DELETE CASCADE,
  staff_id  uuid NOT NULL REFERENCES sva.staff(id)  ON DELETE CASCADE,
  PRIMARY KEY (visit_id, staff_id)
);

-- ─── Visit photos ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sva.visit_photos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id      uuid        NOT NULL REFERENCES sva.visits(id) ON DELETE CASCADE,
  storage_path  text        NOT NULL,  -- sva-photos/{store_id}/{visit_id}/{id}.jpg
  caption       text,
  photo_tag     text        CHECK (photo_tag IN ('display', 'competitor', 'stock', 'staff', 'other')),
  width         int,
  height        int,
  file_size     int,
  analyzed_at   timestamptz,           -- null until Phase 3 AI is enabled
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_visit ON sva.visit_photos(visit_id);

-- ─── Visit plans (pre-visit intent) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sva.visit_plans (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cm_telegram_id  bigint      NOT NULL REFERENCES sva.cms(telegram_id) ON DELETE CASCADE,
  store_id        uuid        NOT NULL REFERENCES sva.stores(id)        ON DELETE CASCADE,
  planned_date    date,
  buzz_plan       text,
  notes           text,
  consumed_at     timestamptz,  -- set when a visit references this plan
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_active
  ON sva.visit_plans(cm_telegram_id, store_id)
  WHERE consumed_at IS NULL;

-- ─── AI insights (empty until Phase 3) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS sva.insights (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id      uuid        NOT NULL REFERENCES sva.visits(id)  ON DELETE CASCADE,
  store_id      uuid        NOT NULL REFERENCES sva.stores(id)  ON DELETE RESTRICT,
  kind          text        NOT NULL
                            CHECK (kind IN ('competitor', 'store', 'relationship', 'sales_opportunity')),
  summary       text        NOT NULL,
  detail        text,
  entities      jsonb,       -- e.g. {"competitor":"Bose","sku":"QC45","staff":"Aisyah"}
  confidence    numeric(3,2) CHECK (confidence BETWEEN 0 AND 1),
  source        text        CHECK (source IN ('notes', 'photo', 'both')),
  extracted_at  timestamptz NOT NULL DEFAULT now(),
  model         text         -- which Claude model produced this
);

CREATE INDEX IF NOT EXISTS idx_insights_kind_date  ON sva.insights(kind, extracted_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_store_kind ON sva.insights(store_id, kind);
CREATE INDEX IF NOT EXISTS idx_insights_entities   ON sva.insights USING GIN(entities);

-- ─── Bot sessions (Telegram conversation state) ───────────────────────────────

CREATE TABLE IF NOT EXISTS sva.bot_sessions (
  telegram_id   bigint      PRIMARY KEY,
  state         jsonb,
  expires_at    timestamptz
);

-- ─── Permissions ─────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA sva TO service_role;
GRANT ALL   ON ALL TABLES    IN SCHEMA sva TO service_role;
GRANT ALL   ON ALL SEQUENCES IN SCHEMA sva TO service_role;
GRANT ALL   ON ALL ROUTINES  IN SCHEMA sva TO service_role;

-- Ensure future tables created in sva also get service_role access
ALTER DEFAULT PRIVILEGES IN SCHEMA sva
  GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sva
  GRANT ALL ON SEQUENCES TO service_role;
