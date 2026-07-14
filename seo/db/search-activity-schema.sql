-- Search-activity capture — the data layer for WSFY ("Who's Searching For You"), built
-- by us and INDEPENDENT of BC. Fired after every teaser/member search returns results;
-- the consumer POSTs a copy to /api/search-activity → these tables. Run once on Neon:
--   cd seo && node --env-file=.env.local scripts/apply-sql.mjs db/search-activity-schema.sql
--
-- Phase 1 = ingest only (build the corpus). The WSFY reverse-join / reveal UI is Phase 2.

CREATE TABLE IF NOT EXISTS search_activity (
  id               BIGSERIAL PRIMARY KEY,
  searcher_type    TEXT,                       -- 'member' | 'anon'
  searcher_user_id TEXT,                       -- member id (null for anon)
  session_id       TEXT,                       -- stable anon session id (null for member)
  search_type      TEXT,                       -- 'name' | 'phone' | 'email'
  source           TEXT,                       -- funnel/source label
  terms            JSONB DEFAULT '{}'::jsonb,  -- raw terms {firstName,lastName,city,state,age,phone,email}
  term_name_norm   TEXT,                       -- normalized "first last" for the WSFY match
  term_first       TEXT,
  term_last        TEXT,
  term_city        TEXT,
  term_state       TEXT,                       -- upper 2-letter
  result_count     INT,
  searched_at      TIMESTAMPTZ,                -- client timestamp
  received_at      TIMESTAMPTZ DEFAULT now(),
  ip               TEXT,
  user_agent       TEXT,
  meta             JSONB DEFAULT '{}'::jsonb,
  -- The SEARCHER's own identity (captured client-side when they're a signed-in member) —
  -- this is what lets WSFY say "Taylor Alldercie searched for you". Null for anon searchers.
  searcher_name      TEXT,
  searcher_name_norm TEXT,
  searcher_first     TEXT,
  searcher_city      TEXT,
  searcher_state     TEXT
);

-- If the table pre-existed (Phase 1), add the searcher-identity columns.
ALTER TABLE search_activity ADD COLUMN IF NOT EXISTS searcher_name      TEXT;
ALTER TABLE search_activity ADD COLUMN IF NOT EXISTS searcher_name_norm TEXT;
ALTER TABLE search_activity ADD COLUMN IF NOT EXISTS searcher_first     TEXT;
ALTER TABLE search_activity ADD COLUMN IF NOT EXISTS searcher_city      TEXT;
ALTER TABLE search_activity ADD COLUMN IF NOT EXISTS searcher_state     TEXT;

-- One row per person returned in a search's result set (as much detail as we can carry).
CREATE TABLE IF NOT EXISTS search_results (
  id           BIGSERIAL PRIMARY KEY,
  activity_id  BIGINT REFERENCES search_activity (id) ON DELETE CASCADE,
  position     INT,                          -- order within the result set
  name         TEXT,
  name_norm    TEXT,                         -- normalized for the WSFY match
  age          TEXT,
  city         TEXT,
  state        TEXT,
  location     TEXT,
  detail       JSONB DEFAULT '{}'::jsonb,    -- the full adapted result object
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- WSFY reverse-join (Phase 2): "find searches whose TERMS or RESULTS match me."
-- Match on stable attributes (name + state/city), never extId — it's ephemeral.
CREATE INDEX IF NOT EXISTS idx_sa_term_name ON search_activity (term_name_norm, term_state);
CREATE INDEX IF NOT EXISTS idx_sa_received  ON search_activity (received_at);
CREATE INDEX IF NOT EXISTS idx_sa_user      ON search_activity (searcher_user_id);
CREATE INDEX IF NOT EXISTS idx_sr_name      ON search_results (name_norm, state);
CREATE INDEX IF NOT EXISTS idx_sr_activity  ON search_results (activity_id);
