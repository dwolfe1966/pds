-- Multi-state first-party inmate roster (the scraping moat — docs/incarceration-data-strategy-provisional.md).
-- Populated write-through from live searches (lib/stateInmates.mjs) + background crawls
-- (scripts/crawl-state-inmates.mjs). Queried by the `dbInmates` provider in lib/incarceration.mjs.
-- Run once on Neon (idempotent). FL stays in its own fl_inmates table (bulk); this is the scraped states.
CREATE TABLE IF NOT EXISTS inmates (
  id             TEXT PRIMARY KEY,             -- `${state}:${source}:${inmate_id}` (stable per person/source)
  state          TEXT NOT NULL,
  source         TEXT, source_name TEXT,
  inmate_id      TEXT,                          -- state DOC number
  first_name     TEXT, middle_name TEXT, last_name TEXT, name TEXT,
  first_norm     TEXT, last_norm TEXT,          -- lowercased for matching
  age            INT, sex TEXT, race TEXT, birth_date TEXT,
  facility       TEXT, county TEXT, release_status TEXT, booking_date TEXT,
  mugshot_url    TEXT,
  charges        JSONB DEFAULT '[]'::jsonb,
  raw            JSONB DEFAULT '{}'::jsonb,
  -- Compliance + freshness (advisor 2026-07-18): once we PERSIST criminal records we own the takedown
  -- obligation, and a served-from-DB record can be stale (person released) — so track both.
  removed        BOOLEAN DEFAULT FALSE,         -- expungement/opt-out takedown — never served
  first_seen     TIMESTAMPTZ DEFAULT now(),
  last_crawled   TIMESTAMPTZ DEFAULT now(),     -- powers the "as of <date>" display + staleness TTL
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inmates_name ON inmates(state, last_norm, first_norm);
CREATE INDEX IF NOT EXISTS idx_inmates_last_crawled ON inmates(last_crawled);
