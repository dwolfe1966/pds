#!/usr/bin/env node

const base = (process.env.SEO_AUDIT_BASE || process.argv[2] || 'http://localhost:3005').replace(/\/$/, '');
const timeoutMs = Number(process.env.SEO_AUDIT_TIMEOUT_MS || 8000);

const checks = [
  {
    path: '/people/fl/miami/michael-smith',
    expect: [200],
    robots: 'noindex, follow',
    canonical: 'https://idlookup.me/people/fl/miami/michael-smith',
    titleIncludes: 'Michael Smith in Miami',
  },
  {
    path: '/people/fl/michael-smith',
    expect: [200],
    robots: 'index, follow',
    canonical: 'https://idlookup.me/people/fl/michael-smith',
    titleIncludes: 'Michael Smith in Florida',
  },
  {
    path: '/fl/michael-smith',
    expect: [200],
    robots: 'index, follow',
    canonical: 'https://idlookup.me/people/fl/michael-smith',
    titleIncludes: 'Michael Smith in Florida',
  },
  {
    path: '/people/fl/county/miami-dade',
    expect: [200],
    robots: 'index, follow',
    canonical: 'https://idlookup.me/people/fl/county/miami-dade',
    titleIncludes: 'Miami-Dade County',
  },
  {
    path: '/people/fl/county/miami-dade/jose-rodriguez',
    expect: [200],
    robots: 'index, follow',
    canonical: 'https://idlookup.me/people/fl/county/miami-dade/jose-rodriguez',
    titleIncludes: 'Jose Rodriguez',
  },
  {
    path: '/people/fl/miami/michael-smith/p0000000001',
    expect: [301, 308],
    locationIncludes: '/people/fl/miami/michael-smith',
  },
  {
    path: '/people/michael-smith/fl/miami/p0000000001',
    expect: [301, 308],
    locationIncludes: '/people/fl/michael-smith',
  },
  {
    path: '/profiles/foo',
    expect: [410],
  },
];

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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

async function audit(check) {
  const res = await fetchWithTimeout(`${base}${check.path}`, {
    redirect: 'manual',
    headers: { 'User-Agent': 'idlookup-deep-audit/1.0' },
  });
  const body = res.status === 200 ? await res.text() : '';
  const got = {
    status: res.status,
    location: res.headers.get('location') || '',
    robots: body ? meta(body, 'robots') : '',
    canonical: body ? canonical(body) : '',
    title: body ? title(body) : '',
  };

  const failures = [];
  if (!check.expect.includes(got.status)) failures.push(`status=${got.status}`);
  if (check.locationIncludes && !got.location.includes(check.locationIncludes)) failures.push(`location=${got.location || '-'}`);
  if (check.robots && got.robots !== check.robots) failures.push(`robots=${got.robots || '-'}`);
  if (check.canonical && got.canonical !== check.canonical) failures.push(`canonical=${got.canonical || '-'}`);
  if (check.titleIncludes && !got.title.includes(check.titleIncludes)) failures.push(`title=${got.title || '-'}`);

  return { ...check, ...got, ok: failures.length === 0, failures };
}

console.log(`SEO deep route audit — ${base}`);
const results = [];
for (const check of checks) {
  try {
    results.push(await audit(check));
  } catch (err) {
    results.push({ ...check, ok: false, failures: [err && err.message ? err.message : String(err)] });
  }
}

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`OK   ${r.path} -> ${r.status}`);
  } else {
    failed += 1;
    console.error(`FAIL ${r.path} -> ${r.failures.join('; ')}`);
  }
}

if (failed) {
  console.error(`\n${failed} deep ${failed === 1 ? 'check' : 'checks'} failed for ${base}`);
  process.exit(1);
}

console.log(`\nAll deep route checks passed for ${base}`);
