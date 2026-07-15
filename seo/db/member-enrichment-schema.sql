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
  -- User-provided profile fields (onboarding / dashboard) — the affinity overlaps the report can't
  -- give us. high_school/college power "went to your high school / college" (BC data has no education).
  high_school TEXT,
  high_school_norm TEXT,
  college     TEXT,
  college_norm TEXT,
  attributes  JSONB DEFAULT '{}'::jsonb, -- misc user-provided fields (future)
  -- Canonical link to the member's own record: the created report's commerceContentId. STABLE and
  -- re-fetchable via getReportDetail() — unlike the ephemeral teaser extId — so we can re-enrich
  -- anytime without re-searching or re-charging. self_person = the confirmed match's stable attrs.
  report_id   TEXT,
  self_person JSONB DEFAULT '{}'::jsonb,
  source      TEXT,                    -- 'self-report' | 'profile' | ...
  enriched_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE member_enrichment ADD COLUMN IF NOT EXISTS report_id        TEXT;
ALTER TABLE member_enrichment ADD COLUMN IF NOT EXISTS self_person      JSONB DEFAULT '{}'::jsonb;
ALTER TABLE member_enrichment ADD COLUMN IF NOT EXISTS past_locations   JSONB DEFAULT '[]'::jsonb; -- prior "City, ST" from address history (for "once lived in your area")
ALTER TABLE member_enrichment ADD COLUMN IF NOT EXISTS high_school      TEXT;
ALTER TABLE member_enrichment ADD COLUMN IF NOT EXISTS high_school_norm TEXT;
ALTER TABLE member_enrichment ADD COLUMN IF NOT EXISTS college          TEXT;
ALTER TABLE member_enrichment ADD COLUMN IF NOT EXISTS college_norm     TEXT;
ALTER TABLE member_enrichment ADD COLUMN IF NOT EXISTS attributes       JSONB DEFAULT '{}'::jsonb;

-- Overlap-match indexes (find searchers who share the subject's school).
CREATE INDEX IF NOT EXISTS idx_me_hs ON member_enrichment (high_school_norm);
CREATE INDEX IF NOT EXISTS idx_me_college ON member_enrichment (college_norm);
