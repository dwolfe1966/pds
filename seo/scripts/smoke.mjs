#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const curlBin = process.env.CURL_BIN || '/usr/bin/curl';
const base = (process.env.SEO_SMOKE_BASE || process.argv[2] || 'http://localhost:3005').replace(/\/$/, '');

const checks = [
  { path: '/', expect: [200], contains: 'People Search' },
  { path: '/people', expect: [200], contains: 'Browse people by state' },
  { path: '/robots.txt', expect: [200], contains: 'Sitemap: https://idlookup.me/sitemap-directory.xml' },
  { path: '/sitemap-directory.xml', expect: [200], contains: '<urlset' },
  { path: '/sitemapv2.xml', expect: [301, 308], locationIncludes: '/sitemap-directory.xml' },
  { path: '/people/fl', expect: [200], contains: 'People Search in Florida' },
  { path: '/people/fl/miami', expect: [200], contains: 'People Search in Miami' },
  { path: '/people/fl/miami/michael-smith', expect: [200], contains: 'Michael Smith in Miami' },
  { path: '/profiles/foo', expect: [410] },
  { path: '/people/michael-smith/fl/miami/p0000000001', expect: [301, 308], locationIncludes: '/people/fl/michael-smith' },
];

async function curl(path) {
  const url = `${base}${path}`;
  const { stdout } = await execFileAsync(curlBin, [
    '-sS',
    '-D', '-',
    '-o', '-',
    '-w', '\n__STATUS__:%{http_code}\n',
    url,
  ], { maxBuffer: 1024 * 1024 * 8 });

  const marker = '\n__STATUS__:';
  const i = stdout.lastIndexOf(marker);
  const status = i >= 0 ? Number(stdout.slice(i + marker.length).trim()) : 0;
  const raw = i >= 0 ? stdout.slice(0, i) : stdout;
  const split = raw.indexOf('\r\n\r\n');
  const sepLen = split >= 0 ? 4 : 2;
  const altSplit = split >= 0 ? split : raw.indexOf('\n\n');
  const headerText = altSplit >= 0 ? raw.slice(0, altSplit) : '';
  const body = altSplit >= 0 ? raw.slice(altSplit + sepLen) : raw;
  const headers = new Map();
  for (const line of headerText.split(/\r?\n/).slice(1)) {
    const p = line.indexOf(':');
    if (p > 0) headers.set(line.slice(0, p).toLowerCase(), line.slice(p + 1).trim());
  }
  return { status, body, location: headers.get('location') || '' };
}

async function check(c) {
  const res = await curl(c.path);
  const okStatus = c.expect.includes(res.status);
  const okBody = !c.contains || res.body.includes(c.contains);
  const okLocation = !c.locationIncludes || res.location.includes(c.locationIncludes);
  const ok = okStatus && okBody && okLocation;
  return { ...c, ...res, ok, okStatus, okBody, okLocation };
}

const results = [];
for (const c of checks) {
  try {
    results.push(await check(c));
  } catch (err) {
    results.push({ ...c, ok: false, error: err && err.message ? err.message : String(err) });
  }
}

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`OK   ${r.path} -> ${r.status}`);
    continue;
  }
  failed += 1;
  const details = r.error
    ? r.error
    : `status=${r.status}; expected=${r.expect.join('/')}; location=${r.location || '-'}`;
  console.error(`FAIL ${r.path} -> ${details}`);
}

if (failed) {
  console.error(`\n${failed} smoke ${failed === 1 ? 'check' : 'checks'} failed for ${base}`);
  process.exit(1);
}

console.log(`\nAll smoke checks passed for ${base}`);
