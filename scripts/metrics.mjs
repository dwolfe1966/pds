#!/usr/bin/env node
/**
 * metrics.mjs — pull REAL performance data (GA4 + Search Console) into the terminal so Claude/you can
 * analyze funnel, conversion, channel and landing-page performance without screenshots.
 *
 * ZERO npm dependencies: mints the service-account JWT with Node's built-in crypto, exchanges it for an
 * OAuth2 access token, and calls the Google REST APIs with global fetch. Nothing is committed — the key
 * lives in a gitignored file and is read at runtime.
 *
 * ── ONE-TIME SETUP (owner) ────────────────────────────────────────────────────────────────────────
 *  1. Google Cloud console → create a Service Account (any project) → Keys → Add key → JSON. Save it to
 *     ./secrets/ga-service-account.json  (this whole folder is gitignored — NEVER commit it).
 *  2. Enable the "Google Analytics Data API" (and "Search Console API" if you want GSC) on that project.
 *  3. GA4 Admin → Property Access Management → add the service-account email (client_email in the JSON)
 *     as a "Viewer". Grab the numeric Property ID (Admin → Property Settings, e.g. 123456789).
 *  4. (Optional GSC) Search Console → Settings → Users and permissions → add the same email as Restricted.
 *
 * ── RUN ───────────────────────────────────────────────────────────────────────────────────────────
 *   GA4_PROPERTY_ID=123456789 node scripts/metrics.mjs                 # last 28 days
 *   GA4_PROPERTY_ID=123456789 DAYS=7 node scripts/metrics.mjs          # last 7 days
 *   GA4_PROPERTY_ID=123456789 GSC_SITE_URL=https://www.idlookup.ai/ node scripts/metrics.mjs
 *   GA4_PROPERTY_ID=123456789 EVENT=purchase node scripts/metrics.mjs  # break a single event down by channel/landing
 *
 * Env / flags:
 *   GA4_PROPERTY_ID   (required)  numeric GA4 property id
 *   GOOGLE_SA_KEY     (optional)  path to the JSON key (default ./secrets/ga-service-account.json)
 *   DAYS              (optional)  lookback window, default 28
 *   GSC_SITE_URL      (optional)  Search Console property (exact, incl. trailing slash) to also pull
 *   EVENT             (optional)  focus a single GA4 event and break it down by channel + landing page
 *   JSON=1            (optional)  emit raw JSON instead of tables (for machine/agent consumption)
 */

import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEY_PATH = process.env.GOOGLE_SA_KEY || path.join(ROOT, 'secrets', 'ga-service-account.json');
const PROPERTY_ID = (process.env.GA4_PROPERTY_ID || '').replace(/^properties\//, '').trim();
const DAYS = Math.max(1, parseInt(process.env.DAYS || '28', 10));
const GSC_SITE_URL = process.env.GSC_SITE_URL || '';
const FOCUS_EVENT = process.env.EVENT || '';
const AS_JSON = process.env.JSON === '1';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function die(msg) { console.error(`\n✖ ${msg}\n`); process.exit(1); }

function loadKey() {
  let raw;
  try { raw = readFileSync(KEY_PATH, 'utf8'); }
  catch { die(`No service-account key at ${KEY_PATH}\n  Create one (see the header of this file for setup) or set GOOGLE_SA_KEY=/path/to/key.json`); }
  let key;
  try { key = JSON.parse(raw); } catch { die(`Key file at ${KEY_PATH} is not valid JSON.`); }
  if (!key.client_email || !key.private_key) die(`Key file is missing client_email / private_key — is it a Service Account JSON key?`);
  return key;
}

// Mint a signed JWT and exchange it for an OAuth2 access token (no googleapis dep).
async function getAccessToken(key, scopes) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: key.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const signature = b64url(signer.sign(key.private_key));
  const assertion = `${header}.${claim}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const json = await res.json();
  if (!res.ok) die(`Token exchange failed (${res.status}): ${json.error_description || json.error || JSON.stringify(json)}`);
  return json.access_token;
}

async function ga4RunReport(token, body) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const m = json.error?.message || JSON.stringify(json);
    if (/permission|caller does not have/i.test(m)) die(`GA4 denied access: ${m}\n  → Add the service-account email as a Viewer on GA4 property ${PROPERTY_ID}.`);
    die(`GA4 runReport failed (${res.status}): ${m}`);
  }
  return json;
}

// ── formatting ──────────────────────────────────────────────────────────────────────────────────
const rows = (report) => (report.rows || []).map((r) => ({
  dims: (r.dimensionValues || []).map((d) => d.value),
  mets: (r.metricValues || []).map((m) => m.value),
}));

function table(title, headers, data) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
  if (!data.length) { console.log('  (no rows)'); return; }
  const cols = headers.map((h, i) => Math.max(h.length, ...data.map((r) => String(r[i] ?? '').length)));
  const line = (arr) => arr.map((c, i) => String(c ?? '').padEnd(cols[i])).join('  ');
  console.log('  ' + line(headers));
  console.log('  ' + cols.map((w) => '─'.repeat(w)).join('  '));
  for (const r of data) console.log('  ' + line(r));
}

const dateRange = () => [{ startDate: `${DAYS}daysAgo`, endDate: 'today' }];

async function main() {
  if (!PROPERTY_ID) die('Set GA4_PROPERTY_ID=<numeric id> (GA4 Admin → Property Settings).');
  const key = loadKey();
  const scopes = ['https://www.googleapis.com/auth/analytics.readonly'];
  if (GSC_SITE_URL) scopes.push('https://www.googleapis.com/auth/webmasters.readonly');
  const token = await getAccessToken(key, scopes);

  const collected = { propertyId: PROPERTY_ID, days: DAYS, generatedAt: new Date().toISOString() };
  console.log(`\n\x1b[1m📊 IDLookup metrics — GA4 property ${PROPERTY_ID} · last ${DAYS} days\x1b[0m`);

  // 1) Events overview
  const events = await ga4RunReport(token, {
    dateRanges: dateRange(),
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'eventCount' }, { name: 'totalUsers' }],
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 30,
  });
  const eventRows = rows(events).map((r) => [r.dims[0], (+r.mets[0]).toLocaleString(), (+r.mets[1]).toLocaleString()]);
  collected.events = eventRows.map(([name, count, users]) => ({ name, count, users }));
  if (!AS_JSON) table('Events (eventCount · users)', ['event', 'count', 'users'], eventRows);

  // 2) Channels — sessions + conversions by source/medium
  const channels = await ga4RunReport(token, {
    dateRanges: dateRange(),
    dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'conversions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
  });
  const channelRows = rows(channels).map((r) => [`${r.dims[0]} / ${r.dims[1]}`, (+r.mets[0]).toLocaleString(), (+r.mets[1]).toLocaleString(), (+r.mets[2]).toLocaleString()]);
  collected.channels = channelRows.map(([sm, sessions, users, conversions]) => ({ sourceMedium: sm, sessions, users, conversions }));
  if (!AS_JSON) table('Channels (source / medium)', ['source / medium', 'sessions', 'users', 'conv'], channelRows);

  // 3) Landing pages — sessions + conversions
  const landings = await ga4RunReport(token, {
    dateRanges: dateRange(),
    dimensions: [{ name: 'landingPagePlusQueryString' }],
    metrics: [{ name: 'sessions' }, { name: 'conversions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 25,
  });
  const landingRows = rows(landings).map((r) => [r.dims[0].slice(0, 60), (+r.mets[0]).toLocaleString(), (+r.mets[1]).toLocaleString()]);
  collected.landings = landingRows.map(([page, sessions, conversions]) => ({ page, sessions, conversions }));
  if (!AS_JSON) table('Landing pages', ['landing page', 'sessions', 'conv'], landingRows);

  // 4) Optional: focus one event, broken down by channel + landing page
  if (FOCUS_EVENT) {
    const byChannel = await ga4RunReport(token, {
      dateRanges: dateRange(),
      dimensions: [{ name: 'sessionSource' }, { name: 'sessionMedium' }],
      metrics: [{ name: 'eventCount' }],
      dimensionFilter: { filter: { fieldName: 'eventName', stringFilter: { value: FOCUS_EVENT } } },
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: 20,
    });
    const focusRows = rows(byChannel).map((r) => [`${r.dims[0]} / ${r.dims[1]}`, (+r.mets[0]).toLocaleString()]);
    collected.focusEvent = { event: FOCUS_EVENT, byChannel: focusRows.map(([sm, count]) => ({ sourceMedium: sm, count })) };
    if (!AS_JSON) table(`Event "${FOCUS_EVENT}" by channel`, ['source / medium', 'count'], focusRows);
  }

  // 5) Optional: Search Console
  if (GSC_SITE_URL) {
    const gsc = await gscQuery(token, GSC_SITE_URL);
    collected.gsc = gsc;
    if (!AS_JSON && gsc) {
      table('Search Console — top pages (clicks · impr · ctr · pos)', ['page', 'clicks', 'impr', 'ctr%', 'pos'],
        gsc.pages.map((p) => [p.page.slice(0, 54), p.clicks, p.impressions, (p.ctr * 100).toFixed(1), p.position.toFixed(1)]));
      table('Search Console — top queries', ['query', 'clicks', 'impr', 'ctr%', 'pos'],
        gsc.queries.map((q) => [q.query.slice(0, 40), q.clicks, q.impressions, (q.ctr * 100).toFixed(1), q.position.toFixed(1)]));
    }
  }

  if (AS_JSON) console.log(JSON.stringify(collected, null, 2));
  else console.log('');
}

async function gscQuery(token, site) {
  const end = new Date();
  const start = new Date(Date.now() - DAYS * 864e5);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const call = async (dimension) => {
    const res = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: fmt(start), endDate: fmt(end), dimensions: [dimension], rowLimit: 15 }),
    });
    const json = await res.json();
    if (!res.ok) { console.error(`  (GSC ${dimension} failed: ${json.error?.message || res.status})`); return []; }
    return (json.rows || []).map((r) => ({ key: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
  };
  const pages = (await call('page')).map((r) => ({ page: r.key, ...r }));
  const queries = (await call('query')).map((r) => ({ query: r.key, ...r }));
  return { pages, queries };
}

main().catch((e) => die(e.stack || String(e)));
