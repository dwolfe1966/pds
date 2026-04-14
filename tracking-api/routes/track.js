/**
 * POST /track — event ingestion (keeps NDJSON compat + SQLite)
 */

const { Router } = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const router = Router();

const DATA_FILE = process.env.TRACKING_DATA_FILE || path.join(__dirname, '..', 'events.ndjson');

function appendNDJSON(event) {
  try {
    fs.appendFileSync(DATA_FILE, JSON.stringify(event) + '\n', 'utf8');
  } catch (e) {
    console.warn('[track] NDJSON append failed:', e.message);
  }
}

router.post('/', (req, res) => {
  const db = require('../db');
  const { event, sessionId, userId, properties, timestamp } = req.body;

  if (!event || typeof event !== 'string') {
    return res.status(400).json({ error: 'event (string) is required' });
  }

  const row = {
    id: crypto.randomUUID(),
    event_name: event,
    session_id: sessionId || null,
    user_id: userId || null,
    properties: properties ? JSON.stringify(properties) : '{}',
    created_at: timestamp || new Date().toISOString(),
  };

  try {
    db.prepare(`
      INSERT INTO events (id, event_name, session_id, user_id, properties, created_at)
      VALUES (@id, @event_name, @session_id, @user_id, @properties, @created_at)
    `).run(row);
  } catch (e) {
    console.error('[track] SQLite insert failed:', e.message);
  }

  // Also write NDJSON for backward compat
  appendNDJSON({
    ...row,
    properties: properties || {},
  });

  res.status(201).json({ ok: true });
});

module.exports = router;
