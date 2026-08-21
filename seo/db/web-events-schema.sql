-- web_events — general activity log for the whole funnel (owner 2026-08-21). The consumer pushes every
-- client event here asynchronously (fire-and-forget) so we can analyze funnels BY VARIANT and by lifecycle
-- (visitor/member/paid) in a DB we own — independent of GA4 (whose service-account access is org-blocked).
-- Run once on Neon (same DB as leads/search-activity: LEADS_DATABASE_URL || DATABASE_URL).
CREATE TABLE IF NOT EXISTS web_events (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),  -- server receive time
  client_ts   TIMESTAMPTZ,                          -- client event time (optional)
  event       TEXT NOT NULL,                        -- landing_view, search_step, teaser_view, unlock, purchase, …
  user_id     TEXT,                                 -- BC user id; NULL when anonymous
  user_state  TEXT NOT NULL DEFAULT 'visitor',      -- visitor | member | paid
  anon_id     TEXT,                                 -- stable per-device id (stitches pre-login events)
  session_id  TEXT,                                 -- per-session id
  variant     TEXT,                                 -- A/B arm (e.g. homefacts-v5)
  shn         TEXT,                                 -- campaign / partner id
  partner     TEXT,                                 -- partner brand (e.g. homefacts)
  page        TEXT,                                 -- path (e.g. /name/landing/homefacts-v5)
  page_data   JSONB NOT NULL DEFAULT '{}'::jsonb,   -- arbitrary event payload
  referrer    TEXT,
  user_agent  TEXT,
  ip_hash     TEXT,                                 -- sha256(ip + salt); never the raw IP
  country     TEXT                                  -- from the CDN geo header
);

CREATE INDEX IF NOT EXISTS web_events_ts_idx       ON web_events (ts DESC);
CREATE INDEX IF NOT EXISTS web_events_event_idx    ON web_events (event);
CREATE INDEX IF NOT EXISTS web_events_variant_idx  ON web_events (variant);
CREATE INDEX IF NOT EXISTS web_events_user_idx     ON web_events (user_id);
CREATE INDEX IF NOT EXISTS web_events_shn_idx      ON web_events (shn);
CREATE INDEX IF NOT EXISTS web_events_state_idx    ON web_events (user_state);
CREATE INDEX IF NOT EXISTS web_events_data_gin     ON web_events USING gin (page_data);
