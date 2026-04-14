/**
 * Exposure score routes
 *
 * GET /api/v1/me/exposure-score
 * GET /api/v1/me/exposure-score/history
 */

const { Router } = require('express');
const crypto = require('crypto');
const auth = require('../middleware/auth');

const router = Router();

function computeGrade(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
}

function computeScoreFromBrokers(db, userId) {
  const brokers = db.prepare('SELECT * FROM broker_exposure WHERE user_id = ?').all(userId);
  if (brokers.length === 0) return { score: 85, grade: 'A', factors: [] };

  const found = brokers.filter(b => b.status === 'found').length;
  const removing = brokers.filter(b => b.status === 'removing').length;
  const removed = brokers.filter(b => b.status === 'removed').length;
  const total = brokers.length;

  // Lower score = worse privacy (more exposure)
  // Start at 100, subtract for each found broker
  let score = 100 - Math.round((found * 4) + (removing * 2));
  score = Math.max(0, Math.min(100, score));

  const factors = [];
  if (found > 0) factors.push({ factor: 'data_brokers_found', impact: -found * 4, detail: `Found on ${found} data broker sites` });
  if (removing > 0) factors.push({ factor: 'removals_in_progress', impact: -removing * 2, detail: `${removing} removal requests pending` });
  if (removed > 0) factors.push({ factor: 'successful_removals', impact: removed * 2, detail: `Removed from ${removed} sites` });

  const recommendations = [];
  if (found > 0) recommendations.push('Request removal from data broker sites where your info was found');
  if (found > 5) recommendations.push('Consider enabling auto-removal for faster protection');
  recommendations.push('Enable monitoring alerts to stay informed of new exposures');

  return { score, grade: computeGrade(score), factors, recommendations };
}

// ── Current score ────────────────────────────────────────────────────────────

router.get('/', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;

  // Get latest score
  let latest = db.prepare('SELECT * FROM exposure_scores WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId);

  if (!latest) {
    // Compute from broker data
    const computed = computeScoreFromBrokers(db, userId);
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO exposure_scores (id, user_id, score, grade, factors, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, computed.score, computed.grade, JSON.stringify(computed.factors), new Date().toISOString());
    latest = db.prepare('SELECT * FROM exposure_scores WHERE id = ?').get(id);
  }

  // Get previous for delta
  const previous = db.prepare(
    'SELECT * FROM exposure_scores WHERE user_id = ? AND id != ? ORDER BY created_at DESC LIMIT 1'
  ).get(userId, latest.id);

  const delta = previous ? latest.score - previous.score : 0;
  const computed = computeScoreFromBrokers(db, userId);

  res.json({
    score: latest.score,
    grade: latest.grade,
    delta,
    previousScore: previous ? previous.score : null,
    factors: latest.factors ? JSON.parse(latest.factors) : computed.factors,
    recommendations: computed.recommendations || [],
    lastUpdated: latest.created_at,
  });
});

// ── Score history ────────────────────────────────────────────────────────────

router.get('/history', auth, (req, res) => {
  const db = require('../db');
  const userId = req.userId;
  const { period = '90d', limit = 50 } = req.query;

  const days = parseInt(period) || 90;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const rows = db.prepare(`
    SELECT * FROM exposure_scores WHERE user_id = ? AND created_at >= ?
    ORDER BY created_at DESC LIMIT ?
  `).all(userId, cutoff, Number(limit)).map(r => ({
    ...r,
    factors: r.factors ? JSON.parse(r.factors) : [],
  }));

  res.json({ docs: rows, period, count: rows.length });
});

module.exports = router;
