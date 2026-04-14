/**
 * Search history + records feed routes
 *
 * GET /api/v1/me/searches
 * GET /api/v1/me/records-feed
 */

const { Router } = require('express');
const auth = require('../middleware/auth');

const router = Router();

// ── Search history ───────────────────────────────────────────────────────────

router.get('/searches', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const { limit = 50, cursor, search_type } = req.query;

  let query = 'SELECT * FROM search_history WHERE user_id = ?';
  const params = [userId];
  if (search_type) { query += ' AND search_type = ?'; params.push(search_type); }
  if (cursor) { query += ' AND id < ?'; params.push(cursor); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit) + 1);

  const rows = db.prepare(query).all(...params).map(r => ({
    ...r,
    query: r.query ? JSON.parse(r.query) : {},
  }));
  const noMoreDocs = rows.length <= Number(limit);
  const docs = rows.slice(0, Number(limit));

  res.json({ docs, noMoreDocs, nextCursor: docs.length ? docs[docs.length - 1].id : null });
});

// ── Records feed ─────────────────────────────────────────────────────────────

router.get('/records-feed', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const { limit = 50, cursor, kind } = req.query;

  let query = 'SELECT * FROM records_feed WHERE user_id = ?';
  const params = [userId];
  if (kind) { query += ' AND kind = ?'; params.push(kind); }
  if (cursor) { query += ' AND id < ?'; params.push(cursor); }
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit) + 1);

  const rows = db.prepare(query).all(...params).map(r => ({
    ...r,
    details: r.details ? JSON.parse(r.details) : {},
  }));
  const noMoreDocs = rows.length <= Number(limit);
  const docs = rows.slice(0, Number(limit));

  res.json({ docs, noMoreDocs, nextCursor: docs.length ? docs[docs.length - 1].id : null });
});

module.exports = router;
