/**
 * Fetch FULL report packets directly via the IIFE (bypassing React nav).
 * Targets record-rich subjects (O.J. Simpson etc.) from test21's report list.
 *   set -a; . scripts/.smoke.env; set +a
 *   node scripts/serve-prod.js & sleep 3
 *   HEADED=1 node scripts/capture-ojreport.js   # user logs in
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const BASE = 'http://localhost:3000';
const EMAIL = process.env.MEMBER_EMAIL;
const TARGETS = [
  { name: 'simpson', id: '6a25df363ee3447608a236a7' },
  { name: 'artz',    id: '6a271b5ecb94b648fd2184b5' },
  { name: 'berry',   id: '6a163c576fec0c32365f8310' },
  { name: 'illions', id: '6a2dd837d1aab9dd0d4d93c0' },
];

(async () => {
  const b = await chromium.launch({ headless: false });
  const p = await (await b.newContext()).newPage();
  p.setDefaultTimeout(30000);
  // capture report-shaped network responses too (backup)
  const net = [];
  p.on('response', async r => {
    if (!/report\/detail/.test(r.url())) return;
    let t = ''; try { t = await r.text(); } catch {}
    net.push({ status: r.status(), len: t.length, hasCrim: /criminal/i.test(t), txt: t });
  });

  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  if (EMAIL) await p.fill('input[name="email"]', EMAIL).catch(() => {});
  console.log('\n>>> BROWSER OPEN — log in as test21, then wait. <<<\n');
  let ok = false;
  for (let i = 0; i < 90 && !ok; i++) { await p.waitForTimeout(2000); ok = await p.evaluate(() => !!localStorage.getItem('accessToken')); }
  console.log('loggedIn:', ok);
  if (!ok) { await b.close(); process.exit(1); }
  await p.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' }).catch(() => {}); // init IIFE
  await p.waitForTimeout(2500);

  const out = await p.evaluate(async (targets) => {
    const w = window.ApiWrapper && window.ApiWrapper.instance;
    const idl = w && w.api && w.api.idLookup;
    const methods = idl ? Object.keys(idl) : [];
    const unwrap = r => (r && typeof r.getData === 'function') ? r.getData() : (r && r.data !== undefined ? r.data : r);
    const results = {};
    for (const t of targets) {
      try {
        if (!idl || !idl.getReport) { results[t.name] = { err: 'no getReport method', methods }; continue; }
        // BC IIFE signature: getReport({ commerceContentId }) -> /report/detail/:commerceContentId
        const r = await idl.getReport({ commerceContentId: t.id });
        results[t.name] = { ok: true, data: unwrap(r) };
      } catch (e) { results[t.name] = { err: String(e && e.message || e) }; }
    }
    return { methods, results };
  }, TARGETS);

  console.log('idLookup methods:', out.methods.join(', '));
  // network backup
  console.log('\nnetwork report/detail hits:', net.map(n => ({ status: n.status, len: n.len, hasCrim: n.hasCrim })));

  // merge IIFE results + network, pick richest by criminal/property presence
  const primOf = j => (j && j.identities && j.identities[0]) || (j && j.result && j.result.identities && j.result.identities[0]) || j || {};
  const candidates = [];
  for (const [name, r] of Object.entries(out.results)) {
    if (r && r.ok && r.data) candidates.push({ name, data: r.data });
    else console.log(`  ${name}: ${r && r.err ? 'ERR ' + r.err : 'no data'}`);
  }
  net.forEach((n, i) => { try { const j = JSON.parse(n.txt); candidates.push({ name: 'net' + i, data: j }); } catch {} });

  const score = c => { const x = primOf(c.data); return (x.criminalList?.length || 0) * 10 + (x.propertyList?.length || 0); };
  candidates.sort((a, c) => score(c) - score(a));
  console.log('\ncandidate richness:', candidates.map(c => { const x = primOf(c.data); return { name: c.name, crim: x.criminalList?.length || 0, prop: x.propertyList?.length || 0 }; }));

  const rich = candidates[0];
  if (!rich) { console.log('NO data captured'); await b.close(); process.exit(1); }
  fs.writeFileSync('/tmp/report-packet.json', JSON.stringify(rich.data, null, 2));
  console.log(`\nrichest = ${rich.name} -> /tmp/report-packet.json (full raw saved)`);
  const prim = primOf(rich.data);
  console.log('primary keys:', Object.keys(prim).join(', '));
  await b.close();
})();
