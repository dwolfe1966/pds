/**
 * Capture a REAL BC get-report packet to discover fields we don't extract.
 * Run behind serve-prod (proxies /api -> dev.www.idlookup.ai) so it hits live BC.
 *
 *   set -a; . scripts/.smoke.env; set +a
 *   node scripts/serve-prod.js & sleep 3
 *   HEADED=1 node scripts/capture-report-packet.js   # user logs in manually
 *
 * Dumps raw keys of criminalList[].offense[]/crime[] and propertyList[].history[]
 * for the richest report, and writes the full packet to /tmp/report-packet.json.
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const BASE = 'http://localhost:3000';
const EMAIL = process.env.MEMBER_EMAIL, PWD = process.env.MEMBER_PWD;

const keysDeep = (o, prefix = '', out = new Set(), depth = 0) => {
  if (!o || typeof o !== 'object' || depth > 3) return out;
  const node = Array.isArray(o) ? o[0] : o;
  if (!node || typeof node !== 'object') return out;
  for (const k of Object.keys(node)) {
    out.add(prefix + k);
    const v = node[k];
    if (v && typeof v === 'object') keysDeep(v, prefix + k + '.', out, depth + 1);
  }
  return out;
};
const primOf = j => (j && j.identities && j.identities[0]) || (j && j.result && j.result.identities && j.result.identities[0]) || j;
const isReport = j => { const p = primOf(j); return p && (p.criminalList || p.propertyList || p.nameList || p.addressList); };

(async () => {
  const HEADED = !!process.env.HEADED;
  const b = await chromium.launch({ headless: !HEADED });
  const p = await (await b.newContext()).newPage();
  p.setDefaultTimeout(30000);

  const apiLog = [];       // diagnostics for every api/proxy response
  const rawReports = [];   // {u, txt} for any report-shaped response
  let listText = '';       // report-list raw body
  const getSnippets = [];  // report/get responses (to see errors)
  p.on('response', async r => {
    const u = r.url();
    if (!/\/api\/|proxy|report/i.test(u)) return;
    let txt = '';
    try { txt = await r.text(); } catch {}
    const hasReport = /"criminalList"|"propertyList"|"nameList"|"addressList"|"identities"/.test(txt);
    const short = u.replace(/^https?:\/\/[^/]+/, '').replace(/clientId=[^&]+/, 'clientId=…').slice(0, 60);
    apiLog.push({ u: short, status: r.status(), len: txt.length, hasReport });
    if (/report\/list/.test(u)) listText = txt;
    if (/report\/(get|detail|view)/.test(u)) getSnippets.push({ u: short, status: r.status(), snip: txt.slice(0, 240) });
    if (hasReport) rawReports.push({ u: short, txt });
  });

  // ---- login (headed = manual) ----
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  let loggedIn = false;
  if (HEADED) {
    if (EMAIL) await p.fill('input[name="email"]', EMAIL).catch(() => {});
    console.log('\n>>> BROWSER OPEN — log in as test21 (email prefilled), then wait ~20s. <<<\n');
    for (let i = 0; i < 90 && !loggedIn; i++) { await p.waitForTimeout(2000); loggedIn = await p.evaluate(() => !!localStorage.getItem('accessToken')); }
  } else {
    await p.fill('input[name="email"]', EMAIL); await p.fill('input[name="password"]', PWD);
    await p.click('button[type="submit"]'); await p.waitForTimeout(5000);
    loggedIn = await p.evaluate(() => !!localStorage.getItem('accessToken'));
  }
  console.log('loggedIn:', loggedIn);
  if (!loggedIn) { console.error('LOGIN FAILED / timed out'); await b.close(); process.exit(1); }

  // ---- trigger report-list (dashboard + account + search-history) ----
  for (const route of ['/dashboard', '/account', '/search-history']) {
    await p.goto(`${BASE}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(3500);
  }

  // save report-list + harvest ids (24-hex strings) from it AND /people/ links
  if (listText) fs.writeFileSync('/tmp/report-list.json', listText);
  const ids = new Set((listText.match(/[0-9a-f]{24}/g) || []));
  const linkIds = await p.evaluate(() => Array.from(document.querySelectorAll('a[href*="/people/"]')).map(a => (a.getAttribute('href').match(/\/people\/([^/?#]+)/) || [])[1]).filter(Boolean));
  linkIds.forEach(i => ids.add(i));
  console.log('report-list bytes:', listText.length, '| candidate ids:', ids.size, [...ids].slice(0, 5));

  // ---- open each report, clearing cache so get-report actually fires ----
  for (const id of [...ids].slice(0, 14)) {
    await p.evaluate((rid) => { try { sessionStorage.removeItem(`report_cache_${rid}`); } catch {} }, id);
    await p.goto(`${BASE}/people/${id}`, { waitUntil: 'networkidle' }).catch(() => {});
    await p.waitForTimeout(4500);
    if (rawReports.length >= 6) break; // enough to pick a rich one
  }

  console.log('\n===== API RESPONSE LOG =====');
  apiLog.slice(0, 45).forEach(l => console.log(`${String(l.status).padEnd(4)} len=${String(l.len).padEnd(7)} report=${l.hasReport?'Y':'.'}  ${l.u}`));
  if (getSnippets.length) { console.log('\n===== report/get responses ====='); getSnippets.slice(0, 6).forEach(s => console.log(`${s.status} ${s.u}\n  ${s.snip}\n`)); }

  const packets = rawReports.map(r => { try { return JSON.parse(r.txt); } catch { return null; } }).filter(Boolean);
  const score = j => { const p2 = primOf(j); return (p2.criminalList?.length || 0) * 10 + (p2.propertyList?.length || 0); };
  packets.sort((a, c) => score(c) - score(a));
  console.log('\npacket summary (crim/prop/propHist):', JSON.stringify(packets.map(j => { const x = primOf(j); return { crim: x.criminalList?.length || 0, prop: x.propertyList?.length || 0, ph: (x.propertyList || []).reduce((n, q) => n + (q.history?.length || 0), 0) }; })));

  const rich = packets[0];
  if (!rich) {
    console.error('\nNO report packets captured. window._lastReportError:');
    console.log(JSON.stringify(await p.evaluate(() => window._lastReportError || null), null, 2));
    await b.close(); process.exit(1);
  }
  const prim = primOf(rich);
  const crim0 = (prim.criminalList || [])[0];
  const prop0 = (prim.propertyList || [])[0];
  console.log('\n===== CRIMINAL[0] raw keys =====\n' + [...keysDeep(crim0)].sort().join('\n'));
  console.log('\n===== CRIMINAL[0].offense[0] FULL =====\n' + JSON.stringify(crim0?.offense?.[0], null, 2));
  console.log('\n===== CRIMINAL[0].crime[0] FULL =====\n' + JSON.stringify(crim0?.crime?.[0], null, 2));
  console.log('\n===== PROPERTY[0] raw keys =====\n' + [...keysDeep(prop0)].sort().join('\n'));
  console.log('\n===== PROPERTY[0].history[0] FULL =====\n' + JSON.stringify(prop0?.history?.[0], null, 2));
  fs.writeFileSync('/tmp/report-packet.json', JSON.stringify(rich, null, 2));
  console.log('\nfull richest packet -> /tmp/report-packet.json');
  await b.close();
})();
