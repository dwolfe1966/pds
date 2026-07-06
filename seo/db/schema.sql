-- IDLookup SEO profile store (Neon Postgres).
-- One row per person, keyed by our STABLE public id (mintPublicId). The full
-- adapted profile lives in `data` (JSONB); the top columns are denormalized for
-- the hub queries (by name, name+state, name+city). Upserts are idempotent on id.

CREATE TABLE IF NOT EXISTS profiles (
  id              TEXT PRIMARY KEY,          -- p + 10 digits (stable, attribute-derived)
  name_slug       TEXT NOT NULL,             -- "david-wexler"
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  state           TEXT NOT NULL,             -- "CA"
  city            TEXT NOT NULL,             -- "Simi Valley"
  city_slug       TEXT NOT NULL,             -- "simi-valley"
  age             INTEGER,
  on_record_since INTEGER,
  indexable       BOOLEAN NOT NULL DEFAULT FALSE,  -- Phase-0 gate; flip per staged batch
  data            JSONB NOT NULL,            -- full profile (aliases, counts, relatives, ...)
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_name            ON profiles (name_slug);
CREATE INDEX IF NOT EXISTS idx_profiles_name_state      ON profiles (name_slug, state);
CREATE INDEX IF NOT EXISTS idx_profiles_name_state_city ON profiles (name_slug, state, city_slug);

-- Progress ledger for the batch-runner: what name×state has been swept, so a run
-- is resumable and we don't re-hit prod for combos already done.
CREATE TABLE IF NOT EXISTS sweep_log (
  name_slug   TEXT NOT NULL,
  state       TEXT NOT NULL,
  total       INTEGER,           -- teaser-reported total for that name×state
  got         INTEGER,           -- identities actually captured
  swept_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (name_slug, state)
);
