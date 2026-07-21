-- First-party sex-offender roster (NSOPW national aggregator — lib/sexOffender.mjs).
-- Populated by background crawls (scripts/crawl-sex-offenders.mjs) via a browser service (NSOPW is
-- Cloudflare-gated). Queried by the `sexOffenderDb` layer for the SEO state/city/name surfaces.
-- Run once on Neon (idempotent). Location-native: each offender carries city/county/state/zip so it
-- serves state pages, city pages, AND name pages from one table (like inmates).
--
-- ⚠️ COMPLIANCE: SO registry display is legally sensitive and state-specific. Owner confirmed display
-- rights 2026-07-20. As with inmates, we OWN the takedown obligation once persisted, and a served record
-- can be stale (moved/removed) — so track `removed` + `last_crawled` and show an "as of" date.
CREATE TABLE IF NOT EXISTS sex_offenders (
  id             TEXT PRIMARY KEY,             -- `${jurisdiction}:nsopw:${offender_id}` (stable per person)
  source         TEXT DEFAULT 'nsopw', source_name TEXT,
  offender_id    TEXT,                          -- NSOPW/registry id (from offenderUri)
  jurisdiction   TEXT,                          -- registry jurisdiction id (usually the 2-letter state)
  first_name     TEXT, last_name TEXT, name TEXT,
  first_norm     TEXT, last_norm TEXT,          -- lowercased for matching
  age            INT, dob TEXT, gender TEXT,
  -- Primary/last-known location (locations[0]); full set in `locations`.
  address        TEXT, city TEXT, county TEXT, state TEXT, zip TEXT,
  city_norm      TEXT, county_norm TEXT,        -- lowercased for city/county page matching
  latitude       DOUBLE PRECISION, longitude DOUBLE PRECISION,
  risk_level     TEXT,                          -- flyer-only per state; usually null from the aggregate
  absconder      BOOLEAN DEFAULT FALSE,
  photo_url      TEXT,                          -- per-jurisdiction registry mugshot
  registry_url   TEXT,                          -- per-jurisdiction offender flyer (authoritative source link)
  offenses       JSONB DEFAULT '[]'::jsonb,     -- aggregate feed carries none; flyer-enrich later
  aliases        JSONB DEFAULT '[]'::jsonb,
  locations      JSONB DEFAULT '[]'::jsonb,
  raw            JSONB DEFAULT '{}'::jsonb,
  removed        BOOLEAN DEFAULT FALSE,         -- opt-out/expungement takedown — never served
  first_seen     TIMESTAMPTZ DEFAULT now(),
  last_crawled   TIMESTAMPTZ DEFAULT now(),     -- powers "as of <date>" + staleness TTL
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_so_name   ON sex_offenders(state, last_norm, first_norm);
CREATE INDEX IF NOT EXISTS idx_so_county ON sex_offenders(state, county_norm);
CREATE INDEX IF NOT EXISTS idx_so_city   ON sex_offenders(state, city_norm);
CREATE INDEX IF NOT EXISTS idx_so_crawled ON sex_offenders(last_crawled);
