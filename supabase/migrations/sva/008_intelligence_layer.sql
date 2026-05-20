-- 008_intelligence_layer.sql
-- Daily intelligence layer: atomic memory notes + typed edges + versioned reports.
-- Both memory notes and reports are append-only — every update inserts a new row.
-- Latest version per key surfaced via the v_*_current views.

-- ─── Visit analysis state ─────────────────────────────────────────────────────

ALTER TABLE sva.visits
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_visits_pending_analysis
  ON sva.visits (locked_at)
  WHERE analyzed_at IS NULL AND is_locked = true;

-- ─── Intelligence recipient flag (separate from is_admin) ─────────────────────

ALTER TABLE sva.cms
  ADD COLUMN IF NOT EXISTS is_intelligence_recipient boolean NOT NULL DEFAULT false;

-- ─── Memory notes (append-only, versioned) ────────────────────────────────────
-- slug examples:
--   store:bd-nac           scope=store    scope_ref=<store uuid>
--   person:sunny           scope=person   scope_ref=sunny
--   theme:bose-rollout     scope=theme    scope_ref=bose-rollout
--   channel:best-denki     scope=channel  scope_ref=best-denki
--
-- Updates: SELECT max(version) FROM sva.memory_notes WHERE slug=$1; INSERT version+1.
-- Reads:   sva.v_memory_notes_current (latest version per slug).

CREATE TABLE IF NOT EXISTS sva.memory_notes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text        NOT NULL,
  scope             text        NOT NULL
                                CHECK (scope IN ('store','person','theme','channel')),
  scope_ref         text        NOT NULL,
  title             text        NOT NULL,
  summary           text        NOT NULL,
  body_markdown     text        NOT NULL,
  related_slugs     text[]      NOT NULL DEFAULT '{}',
  version           int         NOT NULL,
  last_touched_at   timestamptz NOT NULL DEFAULT now(),
  edited_by_human   boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

CREATE INDEX IF NOT EXISTS idx_memory_notes_slug_version
  ON sva.memory_notes (slug, version DESC);

CREATE INDEX IF NOT EXISTS idx_memory_notes_scope
  ON sva.memory_notes (scope, scope_ref);

CREATE INDEX IF NOT EXISTS idx_memory_notes_last_touched
  ON sva.memory_notes (last_touched_at DESC);

-- Tier (short/long) is a derived view over last_touched_at, not a stored column —
-- avoids drift between stored tier and actual recency. Cron and dashboard use this.

CREATE OR REPLACE VIEW sva.v_memory_notes_current AS
SELECT DISTINCT ON (slug)
  id, slug, scope, scope_ref, title, summary, body_markdown, related_slugs,
  version, last_touched_at, edited_by_human, created_at,
  CASE
    WHEN last_touched_at >= now() - interval '14 days' THEN 'short'
    ELSE 'long'
  END AS tier
FROM sva.memory_notes
ORDER BY slug, version DESC;

-- ─── Memory edges (typed connections, dedup on triple) ────────────────────────
-- Edges are deterministic (computed from co-occurrence), not stored opinions —
-- safe to rebuild any time. UNIQUE on triple makes upserts idempotent.

CREATE TABLE IF NOT EXISTS sva.memory_edges (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_slug   text        NOT NULL,
  to_slug     text        NOT NULL,
  edge_type   text        NOT NULL
                          CHECK (edge_type IN (
                            'store_theme',
                            'person_store',
                            'person_theme',
                            'theme_theme'
                          )),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_slug, to_slug, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_memory_edges_from ON sva.memory_edges (from_slug);
CREATE INDEX IF NOT EXISTS idx_memory_edges_to   ON sva.memory_edges (to_slug);

-- ─── Intelligence reports (append-only, versioned) ────────────────────────────
-- One report per date. Re-runs / human edits create version+1.
-- visit_ids captures which visits fed this run (for backfill + audit).

CREATE TABLE IF NOT EXISTS sva.intelligence_reports (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date        date        NOT NULL,
  version            int         NOT NULL,
  brief_markdown     text        NOT NULL,
  stats              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  visit_ids          uuid[]      NOT NULL DEFAULT '{}',
  model              text,
  prompt_tokens      int,
  completion_tokens  int,
  edited_by_human    boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (report_date, version)
);

CREATE INDEX IF NOT EXISTS idx_intelligence_reports_date
  ON sva.intelligence_reports (report_date DESC, version DESC);

CREATE OR REPLACE VIEW sva.v_intelligence_reports_current AS
SELECT DISTINCT ON (report_date) *
FROM sva.intelligence_reports
ORDER BY report_date DESC, version DESC;

-- ─── Advisory lock helper (used by daily cron to prevent concurrent runs / ────
-- ─── edit conflicts during write). Bot/dashboard call:                      ───
-- ───   SELECT pg_try_advisory_lock(hashtext('sva.intelligence.cron'));      ───
-- No DDL needed — pg_advisory_lock is built-in. Documented here for discoverability.
