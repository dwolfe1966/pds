-- Member suppression (Identity Management "Hide me"). A member opts out of OUR surfaces: their
-- search activity is hidden from others' WSFY (isSuppressed). External data-broker removal stays a
-- BC-owned opt-out (we hand off). Run once on Neon.
CREATE TABLE IF NOT EXISTS member_suppression (
  user_id    TEXT PRIMARY KEY,
  name_norm  TEXT,
  state      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppression_name ON member_suppression (name_norm, state);
