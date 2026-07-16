-- Captured teaser data, one row PER PERSON (deduped), keyed by a stable profile_id. Upserted from every
-- search's result set (search-activity ingest) so we accumulate a person corpus we own — the data source
-- for public, crawlable Others-Profile pages on the SEO app. extId is ephemeral, so profile_id keys on
-- stable attributes: norm(name)|state|norm(city). Run once on Neon.
CREATE TABLE IF NOT EXISTS person_profiles (
  profile_id   TEXT PRIMARY KEY,           -- norm(name)|STATE|norm(city)
  name         TEXT,
  name_norm    TEXT,
  first_norm   TEXT,
  last_norm    TEXT,
  city         TEXT,
  state        TEXT,                        -- upper 2-letter
  age          TEXT,
  teaser       JSONB DEFAULT '{}'::jsonb,   -- latest trimmed teaser detail for this person
  search_count INT DEFAULT 1,
  first_seen   TIMESTAMPTZ DEFAULT now(),
  last_seen    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pp_name  ON person_profiles (name_norm, state);
CREATE INDEX IF NOT EXISTS idx_pp_last  ON person_profiles (last_norm, state);
CREATE INDEX IF NOT EXISTS idx_pp_seen  ON person_profiles (last_seen);
