#!/usr/bin/env node

const base = (process.env.SEO_AUDIT_BASE || process.argv[2] || 'http://localhost:3005').replace(/\/$/, '');
const timeoutMs = Number(process.env.SEO_AUDIT_TIMEOUT_MS || 20000);
const stateLimit = Number(process.env.SEO_AUDIT_STATE_LIMIT || 12);
const countyLimit = Number(process.env.SEO_AUDIT_COUNTY_LIMIT || 40);
const countyNameLimit = Number(process.env.SEO_AUDIT_COUNTY_NAME_LIMIT || 20);
const concurrency = Number(process.env.SEO_AUDIT_CONCURRENCY || 6);
const retries = Number(process.env.SEO_AUDIT_RETRIES || 1);
const SITE = 'https://idlookup.me';
const STATES_BY_POP = [
  'ca', 'tx', 'fl', 'ny', 'pa', 'il', 'oh', 'ga', 'nc', 'mi', 'nj', 'va',
  'wa', 'az', 'tn', 'ma', 'in', 'mo', 'md', 'wi', 'co', 'mn', 'sc', 'al',
  'la', 'ky', 'or', 'ok', 'ct', 'ut', 'ia', 'nv', 'ar', 'ms', 'ks', 'nm',
  'ne', 'id', 'wv', 'hi', 'nh', 'me', 'mt', 'ri', 'de', 'sd', 'nd', 'ak',
  'dc', 'vt', 'wy',
];

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return { res, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i).catch((err) => ({ path: items[i], ok: false, failures: [err && err.message ? err.message : String(err)] }));
    }
  });
  await Promise.all(workers);
  return out;
}

function hrefs(body) {
  return [...body.matchAll(/href=["']([^"']+)["']/g)].map((m) => m[1]);
}

function meta(body, name) {
  return (body.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))?.[1] || '').trim();
}

function canonical(body) {
  return (body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '').trim();
}

function title(body) {
  return (body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();
}

const pathOnly = (href) => {
  try { return new URL(href, SITE).pathname; } catch { return href; }
};

async function fetchBody(path) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { res, ms } = await fetchWithTimeout(`${base}${path}`, {
        redirect: 'manual',
        headers: { 'User-Agent': 'idlookup-county-audit/1.0' },
      });
      const body = res.status === 200 ? await res.text() : '';
      return { status: res.status, location: res.headers.get('location') || '', xRobots: res.headers.get('x-robots-tag') || '', body, ms, attempt };
    } catch (err) {
      lastErr = err;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function discoverCountyHubs() {
  const states = STATES_BY_POP.slice(0, stateLimit);
  const found = [];
  for (const st of states) {
    const path = `/people/${st}`;
    try {
      const { status, body } = await fetchBody(path);
      if (status !== 200) continue;
      for (const href of hrefs(body)) {
        const p = pathOnly(href);
        if (/^\/people\/[a-z]{2}\/county\/[a-z0-9-]+$/.test(p)) found.push(p);
      }
    } catch {}
  }
  return [...new Set(found)].slice(0, countyLimit);
}

async function auditCountyHub(path) {
  const { status, location, xRobots, body, ms } = await fetchBody(path);
  const failures = [];
  const robots = body ? meta(body, 'robots') : '';
  const c = body ? canonical(body) : '';
  const t = body ? title(body) : '';
  const hasRecordsList = /People with records in .* County/i.test(body);
  const nameLinks = hrefs(body)
    .map(pathOnly)
    .filter((p) => new RegExp(`^${path}/[a-z]+(?:-[a-z]+)+$`).test(p));

  if (status !== 200) failures.push(`status=${status}${location ? ` location=${location}` : ''}`);
  if (/noindex/i.test(xRobots)) failures.push(`x-robots=${xRobots}`);
  if (robots !== 'index, follow') failures.push(`robots=${robots || '-'}`);
  if (c !== `${SITE}${path}`) failures.push(`canonical=${c || '-'}`);
  if (!t || !t.includes('County')) failures.push(`title=${t || '-'}`);
  if (!hasRecordsList) failures.push('missing records list');
  if (!nameLinks.length) failures.push('missing county-name links');

  return { path, ok: failures.length === 0, failures, ms, nameLinks };
}

async function auditCountyName(path) {
  const { status, location, xRobots, body, ms } = await fetchBody(path);
  const failures = [];
  const robots = body ? meta(body, 'robots') : '';
  const c = body ? canonical(body) : '';
  const t = body ? title(body) : '';
  const hasRecords = /Incarceration records for/i.test(body);

  if (status !== 200) failures.push(`status=${status}${location ? ` location=${location}` : ''}`);
  if (/noindex/i.test(xRobots)) failures.push(`x-robots=${xRobots}`);
  if (robots !== 'index, follow') failures.push(`robots=${robots || '-'}`);
  if (c !== `${SITE}${path}`) failures.push(`canonical=${c || '-'}`);
  if (!t || !t.includes('Incarceration Records')) failures.push(`title=${t || '-'}`);
  if (!hasRecords) failures.push('missing records section');

  return { path, ok: failures.length === 0, failures, ms };
}

console.log(`SEO county audit — ${base}`);
console.log(`  stateLimit=${stateLimit} countyLimit=${countyLimit} countyNameLimit=${countyNameLimit}`);

const countyHubs = await discoverCountyHubs();
console.log(`  discovered county hubs: ${countyHubs.length}`);
if (!countyHubs.length) {
  console.error('No county hubs discovered from sampled state pages.');
  process.exit(1);
}

const hubResults = await mapLimit(countyHubs, concurrency, auditCountyHub);
const countyNames = [...new Set(hubResults.flatMap((r) => r.nameLinks || []))].slice(0, countyNameLimit);
console.log(`  sampled county-name pages: ${countyNames.length}`);
const nameResults = await mapLimit(countyNames, concurrency, auditCountyName);

const all = [...hubResults, ...nameResults];
const failed = all.filter((r) => !r.ok);
const slow = all.filter((r) => Number.isFinite(r.ms) && r.ms > timeoutMs * 0.75);

console.log(`  county hubs checked: ${hubResults.length}`);
console.log(`  county-name pages checked: ${nameResults.length}`);
console.log(`  failures: ${failed.length}`);
console.log(`  slow over ${Math.round(timeoutMs * 0.75)}ms: ${slow.length}`);

for (const row of failed.slice(0, 10)) console.error(`FAIL ${row.path} -> ${row.failures.join('; ')}`);
for (const row of slow.slice(0, 5)) console.warn(`SLOW ${row.path} -> ${row.ms}ms`);

if (failed.length) {
  console.error('County audit failed.');
  process.exit(1);
}

console.log('County audit passed.');
