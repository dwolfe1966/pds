/**
 * IDLookup Tracking API
 * Independently deployable event ingestion + analytics service.
 *
 * Storage: newline-delimited JSON (NDJSON) — zero native dependencies,
 * works on any Node 18+ environment without Python/node-gyp.
 * Swap readEvents()/appendEvent() for a real DB driver when scaling up.
 *
 * Endpoints:
 *   POST /track            — ingest an event (no auth, CORS open)
 *   GET  /health           — liveness check (no auth)
 *   GET  /events           — list raw events (requires x-admin-key)
 *   GET  /events/summary   — funnel + daily + KPI aggregation (requires x-admin-key)
 */

require('dotenv').config({ path: '../.env' });

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app      = express();
const PORT     = process.env.TRACKING_API_PORT || 3002;
const ADMIN_KEY = process.env.TRACKING_ADMIN_KEY || 'dev-admin-key';
const DATA_FILE = process.env.TRACKING_DATA_FILE || path.join(__dirname, 'events.ndjson');

// ── Storage helpers ───────────────────────────────────────────────────────────

function appendEvent(event) {
  fs.appendFileSync(DATA_FILE, JSON.stringify(event) + '\n', 'utf8');
}

function readEvents() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return fs.readFileSync(DATA_FILE, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => { try { return JSON.parse(line); } catch { return null; } })
    .filter(Boolean);
}

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.TRACKING_ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-admin-key'],
}));
app.use(express.json());

function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!key || key !== ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── Funnel definition (ordered) ───────────────────────────────────────────────

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

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString(), events: readEvents().length });
});

// Ingest a single event
app.post('/track', (req, res) => {
  const { event, sessionId, userId, properties, timestamp } = req.body;
  if (!event || typeof event !== 'string') {
    return res.status(400).json({ error: 'event (string) is required' });
  }
  appendEvent({
    id: Date.now() + Math.random().toString(36).slice(2, 6),
    event_name: event,
    session_id: sessionId || null,
    user_id:    userId    || null,
    properties: properties || {},
    created_at: timestamp || new Date().toISOString(),
  });
  res.status(201).json({ ok: true });
});

// List raw events
app.get('/events', requireAdminKey, (req, res) => {
  const { event_name, limit = 100, offset = 0 } = req.query;
  let events = readEvents();
  if (event_name) events = events.filter(e => e.event_name === event_name);
  events.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = events.length;
  const page  = events.slice(Number(offset), Number(offset) + Number(limit));
  res.json({ events: page, count: page.length, total });
});

// Aggregated summary — funnel, daily, KPIs, variants
app.get('/events/summary', requireAdminKey, (req, res) => {
  const events = readEvents();

  const totalEvents    = events.length;
  const uniqueSessions = new Set(events.map(e => e.session_id).filter(Boolean)).size;

  // Funnel counts
  const funnelMap = {};
  FUNNEL_STEPS.forEach(s => { funnelMap[s] = 0; });
  events.forEach(e => { if (funnelMap[e.event_name] !== undefined) funnelMap[e.event_name]++; });
  const funnel = FUNNEL_STEPS.map(step => ({ step, count: funnelMap[step] }));

  // Daily totals — last 14 days
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dailyMap = {};
  events.forEach(e => {
    const day = (e.created_at || '').slice(0, 10);
    if (day >= cutoff) dailyMap[day] = (dailyMap[day] || 0) + 1;
  });
  const daily = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  // KPIs
  const get  = name => funnelMap[name] || 0;
  const rate = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 1000 : null);
  const kpis = {
    searchToResults:   rate(get('results_view'),     get('search_submit')),
    resultsToTeaser:   rate(get('teaser_view'),      get('results_view')),
    teaserToSignup:    rate(get('signup_start'),     get('teaser_view')),
    signupComplete:    rate(get('signup_complete'),  get('signup_start')),
    signupToPayment:   rate(get('payment_complete'), get('signup_complete')),
    overallConversion: rate(get('payment_complete'), get('landing_view')),
  };

  // Top events by volume
  const eventCounts = {};
  events.forEach(e => { eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1; });
  const topEvents = Object.entries(eventCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([event_name, count]) => ({ event_name, count }));

  // Landing variant breakdown
  const variantMap = {};
  events
    .filter(e => e.event_name === 'landing_view' && e.properties?.variant)
    .forEach(e => {
      const key = `${e.properties.variant}|${e.properties.search_type || ''}`;
      if (!variantMap[key]) variantMap[key] = { variant: e.properties.variant, search_type: e.properties.search_type || null, views: 0 };
      variantMap[key].views++;
    });
  const variants = Object.values(variantMap).sort((a, b) => b.views - a.views);

  res.json({ totalEvents, uniqueSessions, funnel, daily, kpis, topEvents, variants });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[tracking-api] http://localhost:${PORT}  (data: ${DATA_FILE})`);
});
