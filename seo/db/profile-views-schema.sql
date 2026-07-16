-- profile_views — the "who viewed my profile" stream (higher intent than a search). One row per
-- profile/report open. subject_* = the person viewed (the reverse-join key for "views of ME");
-- viewer_* = who did the viewing (member or anon). Fed by POST /api/profile-view; read by
-- buildWsfySummary().queryProfileViewers. Run once on Neon (idempotent).
CREATE TABLE IF NOT EXISTS profile_views (
  id                BIGSERIAL PRIMARY KEY,
  viewer_type       TEXT,            -- 'member' | 'anon'
  viewer_user_id    TEXT,
  session_id        TEXT,
  viewer_name       TEXT,
  viewer_name_norm  TEXT,
  viewer_first      TEXT,
  viewer_city       TEXT,
  viewer_state      TEXT,
  subject_profile_id TEXT,           -- person_profiles.profile_id / report id if known
  subject_name      TEXT,
  subject_name_norm TEXT,            -- reverse-join key
  subject_first     TEXT,
  subject_last      TEXT,
  subject_state     TEXT,
  source            TEXT,            -- 'app' | 'seo'
  viewed_at         TIMESTAMPTZ,
  received_at       TIMESTAMPTZ DEFAULT now(),
  ip                TEXT,
  user_agent        TEXT,
  meta              JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_pv_subject      ON profile_views (subject_name_norm, subject_state);
CREATE INDEX IF NOT EXISTS idx_pv_subject_last ON profile_views (subject_last);
CREATE INDEX IF NOT EXISTS idx_pv_viewer       ON profile_views (viewer_user_id);
