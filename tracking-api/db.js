/**
 * SQLite database setup and helpers.
 * Creates tables on first require(), stores DB at data/tracking.db.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = process.env.TRACKING_DB_PATH || path.join(DATA_DIR, 'tracking.db');
const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// ── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    session_id TEXT,
    user_id TEXT,
    properties TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS profile_searches (
    id TEXT PRIMARY KEY,
    target_user_id TEXT NOT NULL,
    searcher_first_name TEXT,
    searcher_last_initial TEXT,
    searcher_city TEXT,
    searcher_state TEXT,
    searcher_tier TEXT DEFAULT 'basic',
    search_type TEXT DEFAULT 'name',
    matched INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ps_target ON profile_searches(target_user_id);

  CREATE TABLE IF NOT EXISTS profile_views (
    id TEXT PRIMARY KEY,
    target_user_id TEXT NOT NULL,
    viewer_first_name TEXT,
    viewer_last_initial TEXT,
    viewer_city TEXT,
    viewer_state TEXT,
    viewer_tier TEXT DEFAULT 'basic',
    sections_viewed TEXT,
    sections_count INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    source TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_pv_target ON profile_views(target_user_id);

  CREATE TABLE IF NOT EXISTS broker_exposure (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    broker_id TEXT NOT NULL,
    broker_name TEXT NOT NULL,
    broker_code TEXT,
    status TEXT DEFAULT 'not_found',
    profile_url TEXT,
    found_at TEXT,
    requested_at TEXT,
    removed_at TEXT,
    last_checked_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_be_user ON broker_exposure(user_id);

  CREATE TABLE IF NOT EXISTS exposure_scores (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    grade TEXT NOT NULL,
    factors TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_es_user ON exposure_scores(user_id);

  CREATE TABLE IF NOT EXISTS watchlist (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    target_type TEXT DEFAULT 'person',
    commerce_content_id TEXT,
    ext_id TEXT,
    display_name TEXT,
    location TEXT,
    notes TEXT,
    has_new_info INTEGER DEFAULT 0,
    changes TEXT,
    added_at TEXT NOT NULL,
    last_checked_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_wl_user ON watchlist(user_id);

  CREATE TABLE IF NOT EXISTS records_feed (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    subkind TEXT,
    source TEXT,
    source_label TEXT,
    summary TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_rf_user ON records_feed(user_id);

  CREATE TABLE IF NOT EXISTS login_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    device TEXT,
    location TEXT,
    status TEXT DEFAULT 'success',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_lh_user ON login_history(user_id);

  CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    search_type TEXT,
    query TEXT,
    results_count INTEGER DEFAULT 0,
    report_generated INTEGER DEFAULT 0,
    commerce_content_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sh_user ON search_history(user_id);

  CREATE TABLE IF NOT EXISTS migrations (
    key TEXT PRIMARY KEY,
    completed_at TEXT NOT NULL
  );
`);

module.exports = db;
