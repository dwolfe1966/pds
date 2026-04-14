/**
 * IDLookup Tracking + Fallback API
 *
 * Expanded from minimal event ingestion into a full standalone backend
 * serving as the fallback API for consumer and admin apps.
 *
 * Storage: SQLite (better-sqlite3) with NDJSON backward compat for /track
 *
 * Endpoints:
 *   POST /track                          — ingest an event (no auth, CORS open)
 *   GET  /health                         — liveness check (no auth)
 *   GET  /events                         — list raw events (requires x-admin-key)
 *   GET  /events/summary                 — funnel + daily + KPI aggregation (x-admin-key)
 *   GET  /api/v1/me/watchers/*           — WSFY/WVMP (JWT)
 *   GET  /api/v1/me/broker-exposure/*    — data broker removal (JWT)
 *   GET  /api/v1/me/exposure-score/*     — privacy score (JWT)
 *   CRUD /api/v1/me/watchlist/*          — watchlist (JWT)
 *   GET  /api/v1/me/searches             — search history (JWT)
 *   GET  /api/v1/me/records-feed         — records feed (JWT)
 *   POST /api/v1/profile-views           — write profile view (JWT)
 *   POST /api/v1/profile-searches        — write profile search (JWT)
 *   GET  /api/v1/admin/users/:id/*       — admin user data (x-admin-key)
 *   POST /api/v1/contact                 — contact form (no auth)
 */

require('dotenv').config({ path: '../.env' });

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

// Initialize DB (creates tables on first run)
const db = require('./db');

const app  = express();
const PORT = process.env.TRACKING_API_PORT || 3002;

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.TRACKING_ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-user-id'],
}));
app.use(express.json());

// ── NDJSON → SQLite migration (one-time) ─────────────────────────────────────

function migrateNDJSON() {
  const DATA_FILE = process.env.TRACKING_DATA_FILE || path.join(__dirname, 'events.ndjson');

  // Check if already migrated
  const migrated = db.prepare("SELECT * FROM migrations WHERE key = 'ndjson_to_sqlite'").get();
  if (migrated) return;

  if (!fs.existsSync(DATA_FILE)) {
    // No NDJSON file, mark as done
    db.prepare("INSERT INTO migrations (key, completed_at) VALUES ('ndjson_to_sqlite', ?)").run(new Date().toISOString());
    return;
  }

  console.log('[migration] Migrating NDJSON events to SQLite...');
  const lines = fs.readFileSync(DATA_FILE, 'utf8').split('\n').filter(Boolean);
  let count = 0;

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO events (id, event_name, session_id, user_id, properties, created_at)
    VALUES (@id, @event_name, @session_id, @user_id, @properties, @created_at)
  `);

  const insertMany = db.transaction((events) => {
    for (const line of events) {
      try {
        const e = JSON.parse(line);
        insertStmt.run({
          id: e.id || (Date.now() + Math.random().toString(36).slice(2, 6)),
          event_name: e.event_name || e.event || '',
          session_id: e.session_id || null,
          user_id: e.user_id || null,
          properties: typeof e.properties === 'string' ? e.properties : JSON.stringify(e.properties || {}),
          created_at: e.created_at || new Date().toISOString(),
        });
        count++;
      } catch (err) {
        // Skip malformed lines
      }
    }
  });

  insertMany(lines);
  db.prepare("INSERT INTO migrations (key, completed_at) VALUES ('ndjson_to_sqlite', ?)").run(new Date().toISOString());
  console.log(`[migration] Migrated ${count} events from NDJSON to SQLite.`);
}

try {
  migrateNDJSON();
} catch (err) {
  console.warn('[migration] NDJSON migration failed (non-fatal):', err.message);
}

// ── Import routers ───────────────────────────────────────────────────────────

const trackRouter      = require('./routes/track');
const healthRouter     = require('./routes/health');
const eventsRouter     = require('./routes/events');
const watchersRouter   = require('./routes/watchers');
const brokersRouter    = require('./routes/brokers');
const scoreRouter      = require('./routes/score');
const watchlistRouter  = require('./routes/watchlist');
const searchesRouter   = require('./routes/searches');
const adminUsersRouter = require('./routes/adminUsers');
const auth             = require('./middleware/auth');

// ── Mount routes ─────────────────────────────────────────────────────────────

// Existing endpoints (backward compat)
app.use('/track', trackRouter);
app.use('/health', healthRouter);
app.use('/events', eventsRouter);

// Consumer API — member routes (JWT required)
app.use('/api/v1/me/watchers', watchersRouter);
app.use('/api/v1/me/broker-exposure', brokersRouter);
app.use('/api/v1/me/exposure-score', scoreRouter);
app.use('/api/v1/me/watchlist', watchlistRouter);
app.use('/api/v1/me', searchesRouter);

// Write endpoints (JWT required)
app.post('/api/v1/profile-views', auth, watchersRouter.postProfileView);
app.post('/api/v1/profile-searches', auth, watchersRouter.postProfileSearch);

// Admin routes (x-admin-key required)
app.use('/api/v1/admin/users', adminUsersRouter);

// Contact form (no auth)
app.post('/api/v1/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!email || !message) {
    return res.status(400).json({ error: 'email and message are required' });
  }
  // Log to events table
  const crypto = require('crypto');
  db.prepare(`
    INSERT INTO events (id, event_name, session_id, user_id, properties, created_at)
    VALUES (?, 'contact_form', NULL, ?, ?, ?)
  `).run(crypto.randomUUID(), email, JSON.stringify({ name, email, subject, message }), new Date().toISOString());

  res.json({ ok: true, message: 'Contact form submitted successfully' });
});

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const eventCount = db.prepare('SELECT COUNT(*) as cnt FROM events').get().cnt;
  console.log(`[tracking-api] http://localhost:${PORT}`);
  console.log(`  SQLite: ${path.join(__dirname, 'data', 'tracking.db')}`);
  console.log(`  Events in DB: ${eventCount}`);
});
