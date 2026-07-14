-- WSFY Phase 2b enrichment. One row per member, holding report-grade attributes used to enrich
-- the "who's searching for you" tease (occupation, employer, verified relatives). Populated by a
-- SEPARATE pipeline — BC person data is IIFE-only (browser) + COGS, so enrichment runs as a
-- browser-side self-lookup on the member (once, amortized), then POSTs here. wsfy.mjs LEFT-joins
-- this optionally: empty/absent table → the tease degrades to corpus-derived affinities.
--   cd seo && node --env-file=.env.local scripts/apply-sql.mjs db/member-enrichment-schema.sql

CREATE TABLE IF NOT EXISTS member_enrichment (
  user_id     TEXT PRIMARY KEY,        -- BC member id (matches search_activity.searcher_user_id)
  occupation  TEXT,                    -- coarse label, e.g. "healthcare", "software", "education"
  employer    TEXT,
  relatives   JSONB DEFAULT '[]'::jsonb, -- array of relative full-names (for verified-relative match)
  city        TEXT,
  state       TEXT,
  source      TEXT,                    -- how enriched (e.g. 'self-teaser', 'report')
  enriched_at TIMESTAMPTZ DEFAULT now()
);
