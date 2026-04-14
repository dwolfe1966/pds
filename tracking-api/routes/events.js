/**
 * GET /events — raw event list (admin)
 * GET /events/summary — funnel + daily + KPI aggregation (admin)
 */

const { Router } = require('express');
const adminAuth = require('../middleware/adminAuth');

const router = Router();

const FUNNEL_STEPS = [
  'landing_view',
  'search_submit',
  'results_view',
  'teaser_view',
  'signup_start',
  'signup_complete',
  'payment_start',
  'payment_complete',
  'report_view',
];

router.get('/', adminAuth, (req, res) => {
  const db = require('../db');
  const { event_name, limit = 100, offset = 0 } = req.query;

  let query = 'SELECT * FROM events';
  const params = [];
  if (event_name) {
    query += ' WHERE event_name = ?';
    params.push(event_name);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const events = db.prepare(query).all(...params).map(e => ({
    ...e,
    properties: e.properties ? JSON.parse(e.properties) : {},
  }));

  let countQuery = 'SELECT COUNT(*) as cnt FROM events';
  const countParams = [];
  if (event_name) {
    countQuery += ' WHERE event_name = ?';
    countParams.push(event_name);
  }
  const total = db.prepare(countQuery).get(...countParams).cnt;

  res.json({ events, count: events.length, total });
});

router.get('/summary', adminAuth, (req, res) => {
  const db = require('../db');

  const totalEvents = db.prepare('SELECT COUNT(*) as cnt FROM events').get().cnt;
  const uniqueSessions = db.prepare('SELECT COUNT(DISTINCT session_id) as cnt FROM events WHERE session_id IS NOT NULL').get().cnt;

  // Funnel counts
  const funnelStmt = db.prepare('SELECT COUNT(*) as cnt FROM events WHERE event_name = ?');
  const funnel = FUNNEL_STEPS.map(step => ({
    step,
    count: funnelStmt.get(step).cnt,
  }));
  const funnelMap = {};
  funnel.forEach(f => { funnelMap[f.step] = f.count; });

  // Daily totals — last 14 days
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const daily = db.prepare(`
    SELECT substr(created_at, 1, 10) as date, COUNT(*) as total
    FROM events WHERE substr(created_at, 1, 10) >= ?
    GROUP BY date ORDER BY date
  `).all(cutoff);

  // KPIs
  const get = name => funnelMap[name] || 0;
  const rate = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 1000 : null);
  const kpis = {
    searchToResults: rate(get('results_view'), get('search_submit')),
    resultsToTeaser: rate(get('teaser_view'), get('results_view')),
    teaserToSignup: rate(get('signup_start'), get('teaser_view')),
    signupComplete: rate(get('signup_complete'), get('signup_start')),
    signupToPayment: rate(get('payment_complete'), get('signup_complete')),
    overallConversion: rate(get('payment_complete'), get('landing_view')),
  };

  // Top events
  const topEvents = db.prepare(`
    SELECT event_name, COUNT(*) as count FROM events
    GROUP BY event_name ORDER BY count DESC LIMIT 20
  `).all();

  // Landing variant breakdown
  const variantEvents = db.prepare(`
    SELECT properties FROM events WHERE event_name = 'landing_view'
  `).all();
  const variantMap = {};
  variantEvents.forEach(e => {
    const props = e.properties ? JSON.parse(e.properties) : {};
    if (props.variant) {
      const key = `${props.variant}|${props.search_type || ''}`;
      if (!variantMap[key]) variantMap[key] = { variant: props.variant, search_type: props.search_type || null, views: 0 };
      variantMap[key].views++;
    }
  });
  const variants = Object.values(variantMap).sort((a, b) => b.views - a.views);

  res.json({ totalEvents, uniqueSessions, funnel, daily, kpis, topEvents, variants });
});

module.exports = router;
