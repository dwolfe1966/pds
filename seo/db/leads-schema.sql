-- Email-lead capture table (consumer funnel leads, e.g. the BV/v11 mid-loader gate).
-- Run once against the Neon DB the leads endpoint uses (LEADS_DATABASE_URL, or
-- DATABASE_URL if that's not set). Kept separate from `profiles` (public directory
-- data) so consumer PII can move to an isolated DB later without a code change —
-- just point LEADS_DATABASE_URL at it.

CREATE TABLE IF NOT EXISTS leads (
  id           BIGSERIAL PRIMARY KEY,
  email        TEXT NOT NULL,
  meta         JSONB DEFAULT '{}'::jsonb,   -- {source, variant, dest, search_type, …}
  source       TEXT,                        -- denormalized from meta for easy filtering
  variant      TEXT,                        -- e.g. v11-serp
  captured_at  TIMESTAMPTZ,                 -- client timestamp (meta.ts)
  received_at  TIMESTAMPTZ DEFAULT now(),
  ip           TEXT,
  user_agent   TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_email    ON leads (email);
CREATE INDEX IF NOT EXISTS idx_leads_received ON leads (received_at);
CREATE INDEX IF NOT EXISTS idx_leads_variant  ON leads (variant);
