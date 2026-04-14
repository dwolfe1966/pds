/**
 * Watchlist routes
 *
 * GET    /api/v1/me/watchlist
 * POST   /api/v1/me/watchlist
 * DELETE /api/v1/me/watchlist/:id
 * GET    /api/v1/me/watchlist/alerts
 */

const { Router } = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');

const router = Router();

// ── List watchlist items ─────────────────────────────────────────────────────

router.get('/', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const { limit = 50, cursor } = req.query;

  let query = 'SELECT * FROM watchlist WHERE user_id = ?';
  const params = [userId];
  if (cursor) { query += ' AND id < ?'; params.push(cursor); }
  query += ' ORDER BY added_at DESC LIMIT ?';
  params.push(Number(limit) + 1);

  const rows = db.prepare(query).all(...params).map(r => ({
    ...r,
    changes: r.changes ? JSON.parse(r.changes) : [],
  }));
  const noMoreDocs = rows.length <= Number(limit);
  const docs = rows.slice(0, Number(limit));

  res.json({ docs, noMoreDocs, nextCursor: docs.length ? docs[docs.length - 1].id : null });
});

// ── Add to watchlist ─────────────────────────────────────────────────────────

router.post('/', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const { targetType, commerceContentId, extId, displayName, location, notes } = req.body;

  if (!displayName) return res.status(400).json({ error: 'displayName required' });

  const row = {
    id: crypto.randomUUID(),
    user_id: userId,
    target_type: targetType || 'person',
    commerce_content_id: commerceContentId || null,
    ext_id: extId || null,
    display_name: displayName,
    location: location || null,
    notes: notes || null,
    has_new_info: 0,
    changes: '[]',
    added_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO watchlist (id, user_id, target_type, commerce_content_id, ext_id,
      display_name, location, notes, has_new_info, changes, added_at, last_checked_at)
    VALUES (@id, @user_id, @target_type, @commerce_content_id, @ext_id,
      @display_name, @location, @notes, @has_new_info, @changes, @added_at, @last_checked_at)
  `).run(row);

  res.status(201).json({ ok: true, id: row.id, item: { ...row, changes: [] } });
});

// ── Remove from watchlist ────────────────────────────────────────────────────

router.delete('/:id', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const { id } = req.params;

  const result = db.prepare('DELETE FROM watchlist WHERE id = ? AND user_id = ?').run(id, userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Item not found' });

  res.json({ ok: true });
});

// ── Alerts (items with changes) ──────────────────────────────────────────────

router.get('/alerts', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;

  const items = db.prepare(
    'SELECT * FROM watchlist WHERE user_id = ? AND has_new_info = 1 ORDER BY last_checked_at DESC'
  ).all(userId).map(r => ({
    ...r,
    changes: r.changes ? JSON.parse(r.changes) : [],
  }));

  res.json({ docs: items, count: items.length });
});

module.exports = router;
