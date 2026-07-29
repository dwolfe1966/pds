#!/usr/bin/env node

const base = (process.env.SEO_AUDIT_BASE || process.argv[2] || 'http://localhost:3005').replace(/\/$/, '');
const concurrency = Number(process.env.SEO_AUDIT_CONCURRENCY || 16);
const timeoutMs = Number(process.env.SEO_AUDIT_TIMEOUT_MS || 8000);

const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
const pathOf = (loc) => {
  try { return new URL(loc).pathname || '/'; } catch { return loc; }
};
const localUrl = (loc) => `${base}${pathOf(loc)}`;

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
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
      out[i] = await fn(items[i], i).catch((err) => ({ error: err && err.message ? err.message : String(err) }));
    }
  });
  await Promise.all(workers);
  return out;
}

function depthStats(urls) {
  const stats = new Map();
  for (const loc of urls) {
    const depth = pathOf(loc).split('/').filter(Boolean).length;
    stats.set(depth, (stats.get(depth) || 0) + 1);
  }
  return [...stats.entries()].sort((a, b) => a[0] - b[0]);
}

function duplicateSamples(urls) {
  const seen = new Set();
  const dupes = [];
  for (const loc of urls) {
    if (seen.has(loc)) dupes.push(loc);
    seen.add(loc);
    if (dupes.length >= 5) break;
  }
  return dupes;
}

async function auditUrl(loc) {
  const url = localUrl(loc);
  const res = await fetchWithTimeout(url, { redirect: 'manual', headers: { 'User-Agent': 'idlookup-seo-audit/1.0' } });
  const status = res.status;
  const location = res.headers.get('location') || '';
  let noindex = false;
  let title = '';
  let canonical = '';

  if (status === 200) {
    const body = await res.text();
    noindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(body);
    title = (body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();
    canonical = (body.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || '').trim();
  }

  return { loc, path: pathOf(loc), status, location, noindex, title, canonical };
}

async function main() {
  console.log(`SEO sitemap audit — ${base}`);
  const sitemapRes = await fetchWithTimeout(`${base}/sitemap-directory.xml`, { headers: { 'User-Agent': 'idlookup-seo-audit/1.0' } });
  if (!sitemapRes.ok) throw new Error(`sitemap-directory.xml returned HTTP ${sitemapRes.status}`);
  const sitemapXml = await sitemapRes.text();
  const urls = locs(sitemapXml);
  const unique = new Set(urls);
  const dupes = duplicateSamples(urls);

  console.log(`  urls: ${urls.length}`);
  console.log(`  unique: ${unique.size}`);
  console.log(`  duplicates: ${urls.length - unique.size}${dupes.length ? ` (${dupes.join(', ')})` : ''}`);
  console.log(`  depth: ${depthStats(urls).map(([d, n]) => `${d}:${n}`).join(' ')}`);

  const results = await mapLimit(urls, concurrency, auditUrl);
  const failures = results.filter((r) => r.error);
  const redirects = results.filter((r) => r.status >= 300 && r.status < 400);
  const notFound = results.filter((r) => r.status === 404 || r.status === 410);
  const badStatus = results.filter((r) => !r.error && r.status !== 200);
  const noindex = results.filter((r) => r.noindex);
  const emptyTitle = results.filter((r) => r.status === 200 && !r.title);
  const missingCanonical = results.filter((r) => r.status === 200 && !r.canonical);

  console.log(`  walked: ${results.length}`);
  console.log(`  fetch errors: ${failures.length}`);
  console.log(`  non-200: ${badStatus.length}`);
  console.log(`  redirects: ${redirects.length}`);
  console.log(`  404/410: ${notFound.length}`);
  console.log(`  noindex: ${noindex.length}`);
  console.log(`  empty titles: ${emptyTitle.length}`);
  console.log(`  missing canonicals: ${missingCanonical.length}`);

  const sample = (label, rows, format = (r) => `${r.path} -> ${r.status || r.error}`) => {
    if (!rows.length) return;
    console.log(`  ${label}:`);
    for (const row of rows.slice(0, 5)) console.log(`    - ${format(row)}`);
  };

  sample('non-200 samples', badStatus, (r) => `${r.path} -> ${r.status}${r.location ? ` ${r.location}` : ''}`);
  sample('fetch error samples', failures, (r) => r.error);
  sample('noindex samples', noindex, (r) => r.path);
  sample('empty title samples', emptyTitle, (r) => r.path);
  sample('missing canonical samples', missingCanonical, (r) => r.path);

  const ok = urls.length === unique.size && badStatus.length === 0 && failures.length === 0
    && noindex.length === 0 && emptyTitle.length === 0 && missingCanonical.length === 0;
  if (!ok) {
    console.error('Audit failed.');
    process.exit(1);
  }
  console.log('Audit passed.');
}

main().catch((err) => {
  console.error('FATAL:', err && err.message ? err.message : String(err));
  process.exit(1);
});
