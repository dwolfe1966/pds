/**
 * Admin user management routes
 *
 * GET /api/v1/admin/users/:id/login-history
 * GET /api/v1/admin/users/:id/activity
 */

const { Router } = require('express');
const adminAuth = require('../middleware/adminAuth');

const router = Router();

// ── Login history ────────────────────────────────────────────────────────────

router.get('/:id/login-history', adminAuth, (req, res) => {
  const db = require('../db');
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const rows = db.prepare(
    'SELECT * FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(id, Number(limit), Number(offset));

  const total = db.prepare('SELECT COUNT(*) as cnt FROM login_history WHERE user_id = ?').get(id).cnt;

  res.json({ docs: rows, count: rows.length, total });
});

// ── User activity (from events) ──────────────────────────────────────────────

router.get('/:id/activity', adminAuth, (req, res) => {
  const db = require('../db');
  const { id } = req.params;
  const { limit = 50, offset = 0, event_name } = req.query;

  let query = 'SELECT * FROM events WHERE user_id = ?';
  const params = [id];
  if (event_name) { query += ' AND event_name = ?'; params.push(event_name); }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const rows = db.prepare(query).all(...params).map(r => ({
    ...r,
    properties: r.properties ? JSON.parse(r.properties) : {},
  }));

  let countQ = 'SELECT COUNT(*) as cnt FROM events WHERE user_id = ?';
  const countP = [id];
  if (event_name) { countQ += ' AND event_name = ?'; countP.push(event_name); }
  const total = db.prepare(countQ).get(...countP).cnt;

  res.json({ docs: rows, count: rows.length, total });
});

module.exports = router;
