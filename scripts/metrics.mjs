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
 * Preferred — log in as YOURSELF (no service-account key; works even when the org blocks SA keys via
 * iam.disableServiceAccountKeyCreation, and needs NO GA4 grant since you already have access):
 *   1. gcloud auth application-default login \
 *        --scopes=https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform
 *   2. gcloud auth application-default set-quota-project <PROJECT_ID>   (a project with the Analytics
 *      Data API enabled — enable at console.cloud.google.com/apis/library/analyticsdata.googleapis.com)
 *   3. Grab the numeric GA4 Property ID (GA4 Admin → Property Settings, e.g. 542993529).
 *   (For GSC add the webmasters.readonly scope to step 1.)
 *
 * Alternate — a service-account JSON key (only if your org ALLOWS SA keys): save to
 *   ./secrets/ga-service-account.json (gitignored), enable the API, and add the client_email as a GA4
 *   Viewer. Set GOOGLE_SA_KEY if it lives elsewhere.
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
const HOME = process.env.HOME || process.env.USERPROFILE || '';
const ADC_PATH = path.join(HOME, '.config', 'gcloud', 'application_default_credentials.json');
// Credential source, first that exists: explicit GOOGLE_SA_KEY → committed-secrets SA key → gcloud ADC
// (user login). ADC ("authorized_user") is the default when the org blocks service-account keys.
function resolveKeyPath() {
  const candidates = [process.env.GOOGLE_SA_KEY, path.join(ROOT, 'secrets', 'ga-service-account.json'), ADC_PATH].filter(Boolean);
  for (const p of candidates) { try { readFileSync(p); return p; } catch { /* next */ } }
  return candidates[candidates.length - 1];
}
const KEY_PATH = resolveKeyPath();
const PROPERTY_ID = (process.env.GA4_PROPERTY_ID || '').replace(/^properties\//, '').trim();
const DAYS = Math.max(1, parseInt(process.env.DAYS || '28', 10));
const GSC_SITE_URL = process.env.GSC_SITE_URL || '';
const FOCUS_EVENT = process.env.EVENT || '';
const AS_JSON = process.env.JSON === '1';
// GA4 Data API bills quota to a project when the caller is a USER (ADC). Taken from the ADC file's
// quota_project_id, or GOOGLE_CLOUD_QUOTA_PROJECT. Sent as x-goog-user-project.
let USER_PROJECT = process.env.GOOGLE_CLOUD_QUOTA_PROJECT || '';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function die(msg) { console.error(`\n✖ ${msg}\n`); process.exit(1); }

const ADC_LOGIN = 'gcloud auth application-default login --scopes=https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform';

function loadKey() {
  let raw;
  try { raw = readFileSync(KEY_PATH, 'utf8'); }
  catch { die(`No credentials found (looked in secrets/ and gcloud ADC).\n  Log in as yourself:  ${ADC_LOGIN}\n  (or point GOOGLE_SA_KEY at a service-account JSON key)`); }
  let key;
  try { key = JSON.parse(raw); } catch { die(`Credential file at ${KEY_PATH} is not valid JSON.`); }
  const isSA = key.type === 'service_account' || (key.client_email && key.private_key);
  const isUser = key.type === 'authorized_user' || (key.client_id && key.refresh_token);
  if (!isSA && !isUser) die(`Credential file at ${KEY_PATH} is neither a service-account key nor a gcloud ADC login.`);
  key._kind = isSA ? 'sa' : 'user';
  return key;
}

// Exchange credentials for an OAuth2 access token (no googleapis dep). Handles both a gcloud ADC user
// login (refresh-token grant) and a service-account key (signed JWT bearer).
async function getAccessToken(key, scopes) {
  if (key._kind === 'user') {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: key.client_id, client_secret: key.client_secret, refresh_token: key.refresh_token, grant_type: 'refresh_token' }),
    });
    const json = await res.json();
    if (!res.ok) die(`ADC token refresh failed (${res.status}): ${json.error_description || json.error || JSON.stringify(json)}\n  Re-login: ${ADC_LOGIN}`);
    return json.access_token;
  }
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

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...(USER_PROJECT ? { 'x-goog-user-project': USER_PROJECT } : {}),
});

async function ga4RunReport(token, body) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    const m = json.error?.message || JSON.stringify(json);
    if (/permission|caller does not have/i.test(m)) die(`GA4 denied access: ${m}\n  → You (the logged-in user) need at least Viewer on GA4 property ${PROPERTY_ID}.`);
    if (/user.?project|quota project|billing/i.test(m)) die(`GA4 needs a quota project: ${m}\n  → gcloud auth application-default set-quota-project <PROJECT_ID>  (a project with the Analytics Data API enabled)`);
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
  if (!USER_PROJECT && key.quota_project_id) USER_PROJECT = key.quota_project_id;
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
      headers: authHeaders(token),
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
