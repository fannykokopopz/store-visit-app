-- 007_settings.sql
-- Simple key/value store for runtime-configurable bot settings.
-- Currently used for broadcast_chat_id (set via /setalertgroup).

CREATE TABLE IF NOT EXISTS sva.settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_telegram_id bigint
);
