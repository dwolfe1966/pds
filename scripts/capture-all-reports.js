/**
 * Fetch ALL of test21's reports via the IIFE getReport and build a coverage matrix of
 * which BC *List sections each populates — to find packets exercising the unverified
 * lists (judgment/bankruptcy/vehicle/business/employment/aircraft/...).
 *   set -a; . scripts/.smoke.env; set +a
 *   node scripts/serve-prod.js & sleep 3
 *   HEADED=1 node scripts/capture-all-reports.js    # user logs in
 * Saves each full packet to /tmp/rpt-<id>.json and prints the matrix.
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const BASE = 'http://localhost:3000';
const EMAIL = process.env.MEMBER_EMAIL;

const ids = (() => {
  try {
    const j = JSON.parse(fs.readFileSync('/tmp/report-list.json', 'utf8'));
    return (j.commerceContents || []).map(c => c._id).filter(Boolean);
  } catch { return []; }
})();

(async () => {
  if (!ids.length) { console.error('No /tmp/report-list.json — run capture-report-packet.js first'); process.exit(1); }
  const b = await chromium.launch({ headless: !process.env.HEADED });
  const p = await (await b.newContext()).newPage();
  p.setDefaultTimeout(30000);
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  if (EMAIL) await p.fill('input[name="email"]', EMAIL).catch(() => {});
  console.log('\n>>> BROWSER OPEN — log in as test21, then wait. <<<\n');
  let ok = false;
  for (let i = 0; i < 90 && !ok; i++) { await p.waitForTimeout(2000); ok = await p.evaluate(() => !!localStorage.getItem('accessToken')); }
  console.log('loggedIn:', ok); if (!ok) { await b.close(); process.exit(1); }
  await p.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(2000);

  const results = await p.evaluate(async (idList) => {
    const w = window.ApiWrapper && window.ApiWrapper.instance;
    const idl = w && w.api && w.api.idLookup;
    const unwrap = r => (r && typeof r.getData === 'function') ? r.getData() : (r && r.data !== undefined ? r.data : r);
    const out = {};
    for (const id of idList) {
      try {
        const r = await idl.getReport({ commerceContentId: id });
        const d = unwrap(r);
        const prim = d?.commerceContent?.raws?.[0]?.transient?.identities?.[0] || {};
        const counts = {};
        Object.keys(prim).forEach(k => { if (k.endsWith('List') && Array.isArray(prim[k]) && prim[k].length) counts[k] = prim[k].length; });
        out[id] = { ok: true, counts, raw: d };
      } catch (e) { out[id] = { err: String(e && e.message || e) }; }
    }
    return out;
  }, ids);

  // save packets + build matrix
  const allLists = new Set();
  for (const [id, r] of Object.entries(results)) {
    if (r.ok && r.counts) Object.keys(r.counts).forEach(k => allLists.add(k));
    if (r.ok && r.raw) { try { fs.writeFileSync(`/tmp/rpt-${id}.json`, JSON.stringify(r.raw)); } catch {} }
  }
  const sorted = [...allLists].sort();
  console.log('\n=== COVERAGE MATRIX (list -> total across all reports) ===');
  const totals = {};
  Object.values(results).forEach(r => r.ok && Object.entries(r.counts).forEach(([k, v]) => totals[k] = (totals[k] || 0) + v));
  sorted.forEach(k => console.log(`${k.padEnd(24)} ${totals[k]}`));
  console.log('\n=== per-report (id -> populated lists) ===');
  for (const [id, r] of Object.entries(results)) {
    console.log(`${id}: ${r.ok ? Object.keys(r.counts).join(', ') : 'ERR ' + r.err}`);
  }
  console.log('\nsaved packets: /tmp/rpt-<id>.json');
  await b.close();
})();
