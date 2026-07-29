#!/usr/bin/env node

const base = (process.env.SEO_AUDIT_BASE || process.argv[2] || 'http://localhost:3005').replace(/\/$/, '');
const timeoutMs = Number(process.env.SEO_AUDIT_TIMEOUT_MS || 20000);
const concurrency = Number(process.env.SEO_AUDIT_CONCURRENCY || 6);
const SITE = 'https://idlookup.me';

const samples = [
  { path: '/people/fl/michael-smith', stateName: 'Florida' },
  { path: '/people/fl/jose-rodriguez', stateName: 'Florida' },
  { path: '/people/nc/michael-smith', stateName: 'North Carolina' },
  { path: '/people/nc/james-smith', stateName: 'North Carolina' },
  { path: '/people/il/michael-smith', stateName: 'Illinois' },
  { path: '/people/pa/michael-smith', stateName: 'Pennsylvania' },
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
      out[i] = await fn(items[i], i).catch((err) => ({ ...items[i], ok: false, failures: [err && err.message ? err.message : String(err)] }));
    }
  });
  await Promise.all(workers);
  return out;
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

async function fetchBody(path) {
  const { res, ms } = await fetchWithTimeout(`${base}${path}`, {
    redirect: 'manual',
    headers: { 'User-Agent': 'idlookup-name-state-audit/1.0' },
  });
  const body = res.status === 200 ? await res.text() : '';
  return { status: res.status, location: res.headers.get('location') || '', body, ms };
}

async function auditNameState(item) {
  const { status, location, body, ms } = await fetchBody(item.path);
  const failures = [];
  const robots = body ? meta(body, 'robots') : '';
  const c = body ? canonical(body) : '';
  const t = body ? title(body) : '';
  const hasRecords = /Incarceration records for|Registered sex offenders named/i.test(body);

  if (status !== 200) failures.push(`status=${status}${location ? ` location=${location}` : ''}`);
  if (robots !== 'index, follow') failures.push(`robots=${robots || '-'}`);
  if (c !== `${SITE}${item.path}`) failures.push(`canonical=${c || '-'}`);
  if (!t || !t.includes(`in ${item.stateName}`)) failures.push(`title=${t || '-'}`);
  if (!hasRecords) failures.push('missing first-party records section');

  return { ...item, ok: failures.length === 0, failures, ms };
}

async function auditRootAlias(item) {
  const aliasPath = item.path.replace(/^\/people/, '');
  const { status, body, ms } = await fetchBody(aliasPath);
  const failures = [];
  const robots = body ? meta(body, 'robots') : '';
  const c = body ? canonical(body) : '';
  const t = body ? title(body) : '';

  if (status !== 200) failures.push(`status=${status}`);
  if (robots !== 'index, follow') failures.push(`robots=${robots || '-'}`);
  if (c !== `${SITE}${item.path}`) failures.push(`canonical=${c || '-'}`);
  if (!t || !t.includes(`in ${item.stateName}`)) failures.push(`title=${t || '-'}`);

  return { path: aliasPath, canonicalPath: item.path, ok: failures.length === 0, failures, ms };
}

console.log(`SEO name-in-state audit — ${base}`);
console.log(`  samples=${samples.length}`);

const pageResults = await mapLimit(samples, concurrency, auditNameState);
const aliasResults = await mapLimit(samples, concurrency, auditRootAlias);
const all = [...pageResults, ...aliasResults];
const failed = all.filter((r) => !r.ok);
const slow = all.filter((r) => Number.isFinite(r.ms) && r.ms > timeoutMs * 0.75);

console.log(`  name-in-state pages checked: ${pageResults.length}`);
console.log(`  root aliases checked: ${aliasResults.length}`);
console.log(`  failures: ${failed.length}`);
console.log(`  slow over ${Math.round(timeoutMs * 0.75)}ms: ${slow.length}`);

for (const row of failed.slice(0, 10)) console.error(`FAIL ${row.path} -> ${row.failures.join('; ')}`);
for (const row of slow.slice(0, 5)) console.warn(`SLOW ${row.path} -> ${row.ms}ms`);

if (failed.length) {
  console.error('Name-in-state audit failed.');
  process.exit(1);
}

console.log('Name-in-state audit passed.');
