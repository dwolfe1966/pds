/**
 * Broker exposure routes
 *
 * GET  /api/v1/me/broker-exposure
 * POST /api/v1/me/broker-exposure/:brokerId/request
 * POST /api/v1/me/broker-exposure/:brokerId/cancel
 * GET  /api/v1/me/broker-exposure/history
 * POST /api/v1/me/broker-exposure/scan
 */

const { Router } = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');

const router = Router();

// ── List broker exposure with summary ────────────────────────────────────────

router.get('/', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;

  const brokers = db.prepare('SELECT * FROM broker_exposure WHERE user_id = ? ORDER BY broker_name').all(userId);

  const totalBrokers = brokers.length;
  const found = brokers.filter(b => b.status === 'found').length;
  const removing = brokers.filter(b => b.status === 'removing').length;
  const removed = brokers.filter(b => b.status === 'removed').length;
  const notFound = brokers.filter(b => b.status === 'not_found').length;
  const progressPercent = totalBrokers > 0
    ? Math.round(((removed + notFound) / totalBrokers) * 100)
    : 0;

  res.json({
    summary: { totalBrokers, found, removing, removed, notFound, progressPercent },
    brokers,
  });
});

// ── Request removal ──────────────────────────────────────────────────────────

router.post('/:brokerId/request', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const { brokerId } = req.params;

  const broker = db.prepare('SELECT * FROM broker_exposure WHERE user_id = ? AND broker_id = ?').get(userId, brokerId);
  if (!broker) return res.status(404).json({ error: 'Broker entry not found' });

  db.prepare(`
    UPDATE broker_exposure SET status = 'removing', requested_at = ? WHERE id = ?
  `).run(new Date().toISOString(), broker.id);

  // Add to records feed
  db.prepare(`
    INSERT INTO records_feed (id, user_id, kind, subkind, source, source_label, summary, details, created_at)
    VALUES (?, ?, 'removal_requested', NULL, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(), userId, broker.broker_code, broker.broker_name,
    `Removal requested from ${broker.broker_name}`,
    JSON.stringify({ brokerId, brokerName: broker.broker_name }),
    new Date().toISOString()
  );

  res.json({ ok: true, status: 'removing' });
});

// ── Cancel removal ───────────────────────────────────────────────────────────

router.post('/:brokerId/cancel', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const { brokerId } = req.params;

  const broker = db.prepare('SELECT * FROM broker_exposure WHERE user_id = ? AND broker_id = ?').get(userId, brokerId);
  if (!broker) return res.status(404).json({ error: 'Broker entry not found' });

  db.prepare(`
    UPDATE broker_exposure SET status = 'found', requested_at = NULL WHERE id = ?
  `).run(broker.id);

  res.json({ ok: true, status: 'found' });
});

// ── Removal history ──────────────────────────────────────────────────────────

router.get('/history', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const { limit = 50, cursor } = req.query;

  let query = `SELECT * FROM records_feed WHERE user_id = ? AND kind IN ('removal_requested', 'removal_completed', 'broker_scan')`;
  const params = [userId];

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

// ── Scan (mock) ──────────────────────────────────────────────────────────────

router.post('/scan', auth, (req, res) => {
  res.json({
    success: true,
    scanId: crypto.randomUUID(),
    estimatedCompletionSeconds: 120,
    message: 'Broker scan initiated. Results will be updated when complete.',
  });
});

module.exports = router;
