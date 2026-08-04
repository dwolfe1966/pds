-- Exposure Graph — the spine for digital-footprint management.
-- See docs/product/exposure-graph-spine.md. Tables are ALSO self-created lazily by
-- lib/exposure-graph-db.mjs (ensureTables), so this file is the canonical reference; you don't
-- have to run it manually. Same Neon DB as leads/search-activity (LEADS_DATABASE_URL).

-- One node per place-a-person-appears, on one provider. Unit of itemization = (subject, source, url).
CREATE TABLE IF NOT EXISTS exposure_node (
  id             BIGSERIAL PRIMARY KEY,
  subject_key    TEXT NOT NULL,               -- verified identity (member userId, or stable identity hash)
  surface_type   TEXT NOT NULL,               -- idlookup|data_broker|public_record|search_result|social_profile|breach|image|ai_answer|other
  source_key     TEXT NOT NULL,               -- normalized provider id: 'spokeo','google','idlookup','breach:<name>'
  url            TEXT NOT NULL DEFAULT '',     -- specific listing URL ('' = the canonical node for that source)
  found_status   TEXT NOT NULL DEFAULT 'unknown',  -- found|not_found|unknown
  data_types     TEXT[] NOT NULL DEFAULT '{}', -- ['name','address','phone','email','relatives','dob',...]
  exposure_detail JSONB,                       -- snapshot of exposed values (server-side; PII)
  screenshot_url TEXT,
  sentiment      TEXT,                         -- positive|neutral|negative|null (search/social/ai)
  confidence     TEXT NOT NULL DEFAULT 'medium', -- high|medium|low
  severity       INT  NOT NULL DEFAULT 1,      -- weight for the exposure score
  control_status TEXT NOT NULL DEFAULT 'none', -- none|hidden|optout_requested|optout_confirmed|removed|reappeared|correction_requested|promoted
  control_method TEXT,                         -- our_suppression|optery|onerep|manual|google_rar|drop|owner
  external_ref   TEXT,                         -- vendor id for this exposure (status sync)
  first_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_changed   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_key, source_key, url)
);
CREATE INDEX IF NOT EXISTS idx_expnode_subject ON exposure_node(subject_key);
CREATE INDEX IF NOT EXISTS idx_expnode_surface ON exposure_node(surface_type);
CREATE INDEX IF NOT EXISTS idx_expnode_status  ON exposure_node(control_status);

-- Append-only history per node (timeline, monitoring, proof).
CREATE TABLE IF NOT EXISTS exposure_event (
  id          BIGSERIAL PRIMARY KEY,
  node_id     BIGINT,
  subject_key TEXT NOT NULL,
  event_type  TEXT NOT NULL,   -- discovered|optout_submitted|removed|reappeared|correction_submitted|annotated|promoted|rescanned
  method      TEXT,
  detail      JSONB,
  screenshot_url TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expevent_subject ON exposure_event(subject_key);

-- Provider catalog — drives scanning, the itemized UI, and per-source removal routing.
CREATE TABLE IF NOT EXISTS source_registry (
  source_key     TEXT PRIMARY KEY,
  surface_type   TEXT NOT NULL,
  display_name   TEXT NOT NULL,
  category       TEXT,
  opt_out_url    TEXT,
  removal_method TEXT,
  relist_days    INT,
  weight         INT NOT NULL DEFAULT 1
);

-- Owner Voice — the identity owner's annotation on a node/record.
CREATE TABLE IF NOT EXISTS owner_annotation (
  id          BIGSERIAL PRIMARY KEY,
  subject_key TEXT NOT NULL,
  node_id     BIGINT,
  note        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|rejected
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
