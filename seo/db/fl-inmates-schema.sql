-- Florida OBIS inmates — free FL DOC bulk data ingested via scripts/ingest-florida-obis.mjs.
-- Queried by the florida-obis provider in lib/incarceration.mjs. Run once on Neon (idempotent).
CREATE TABLE IF NOT EXISTS fl_inmates (
  dc_number      TEXT PRIMARY KEY,
  first_name     TEXT, middle_name TEXT, last_name TEXT,
  first_norm     TEXT, last_norm  TEXT,
  race           TEXT, sex        TEXT, birth_date TEXT,
  custody_status TEXT, facility   TEXT, release_date TEXT,
  offenses       JSONB DEFAULT '[]'::jsonb,
  aliases        JSONB DEFAULT '[]'::jsonb,
  source_file    TEXT, updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fl_inmates_name ON fl_inmates(last_norm, first_norm);
