/**
 * Drive the app's real member search to create reports on record-diverse subjects and
 * capture which BC *List sections each populates — to verify the still-unconfirmed
 * extractors (bankruptcy/vehicle/aircraft/business/employment/driverLicense/veteran...).
 * Uses the REAL search UI (never hand-rolls contextKey/teaserInput).
 *   set -a; . scripts/.smoke.env; set +a
 *   node scripts/serve-prod.js & sleep 3
 *   HEADED=1 node scripts/capture-new-subjects.js   # log in + solve captchas as they pop
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const BASE = 'http://localhost:3000';
const EMAIL = process.env.MEMBER_EMAIL;
const SUBJECTS = [
  { first: 'Donald', last: 'Trump', state: 'NY' },
  { first: 'John', last: 'Travolta', state: 'FL' },
  { first: 'Martha', last: 'Stewart', state: 'CT' },
  { first: 'Colin', last: 'Powell', state: 'VA' },
];
const primOf = (j) => j?.commerceContent?.raws?.[0]?.transient?.identities?.[0]
  || (j?.identities && j.identities[0]) || (j?.result?.identities && j.result.identities[0]) || null;

(async () => {
  const b = await chromium.launch({ headless: !process.env.HEADED });
  const p = await (await b.newContext()).newPage();
  p.setDefaultTimeout(30000);
  let lastReport = null;
  p.on('response', async (r) => {
    if (!/\/api\/|report|proxy/i.test(r.url())) return;
    let t = ''; try { t = await r.text(); } catch {}
    if (!/"criminalList"|"propertyList"|"nameList"|"identities"/.test(t)) return;
    try { const j = JSON.parse(t); if (primOf(j)) lastReport = j; } catch {}
  });

  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  if (EMAIL) await p.fill('input[name="email"]', EMAIL).catch(() => {});
  console.log('\n>>> Log in as test21. Then SOLVE THE CAPTCHA each time a search runs. <<<\n');
  let ok = false;
  for (let i = 0; i < 90 && !ok; i++) { await p.waitForTimeout(2000); ok = await p.evaluate(() => !!localStorage.getItem('accessToken')); }
  if (!ok) { console.error('login timed out'); await b.close(); process.exit(1); }
  console.log('loggedIn. Running searches…\n');

  const found = {};
  for (let s = 0; s < SUBJECTS.length; s++) {
    const subj = SUBJECTS[s];
    try {
      lastReport = null;
      await p.goto(`${BASE}/people-search`, { waitUntil: 'networkidle' }).catch(() => {});
      await p.waitForTimeout(1500);
      await p.fill('#gs-firstName', subj.first);
      await p.fill('#gs-lastName', subj.last);
      await p.fill('#gs-state', subj.state).catch(() => {});
      await p.locator('form button[type="submit"], button[type="submit"]').first().click().catch(() => {});
      console.log(`[${subj.first} ${subj.last}] submitted — solve captcha if prompted…`);
      // wait for result cards (user solves captcha in between)
      let clicked = false;
      for (let i = 0; i < 60 && !clicked; i++) {
        await p.waitForTimeout(2000);
        const card = p.locator('a[href*="/people/"], [class*="resultCard" i], button:has-text("View")').first();
        if (await card.count() && await card.isVisible().catch(() => false)) { await card.click().catch(() => {}); clicked = true; }
      }
      if (!clicked) { console.log(`  no results/timeout for ${subj.last}`); continue; }
      // wait for the created report to come back over the wire
      for (let i = 0; i < 20 && !lastReport; i++) await p.waitForTimeout(1500);
      if (!lastReport) { console.log(`  report not captured for ${subj.last}`); continue; }
      const prim = primOf(lastReport);
      const counts = {};
      Object.keys(prim).forEach((k) => { if (k.endsWith('List') && Array.isArray(prim[k]) && prim[k].length) counts[k] = prim[k].length; });
      found[`${subj.first} ${subj.last}`] = counts;
      fs.writeFileSync(`/tmp/newrpt-${s}-${subj.last}.json`, JSON.stringify(lastReport));
      console.log(`  -> lists: ${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(', ')}`);
    } catch (e) { console.log(`  error on ${subj.last}: ${String(e.message).slice(0, 60)}`); }
  }

  console.log('\n=== SUMMARY ===');
  const UNVERIFIED = ['bankruptcyList', 'motorVehicleList', 'aircraftList', 'businessList', 'employmentList', 'driverLicenseList', 'veteranList', 'sanctionsList', 'deathList', 'socialList', 'ipList'];
  const hit = new Set();
  Object.entries(found).forEach(([n, c]) => { console.log(`${n}: ${Object.keys(c).join(', ') || '(none)'}`); Object.keys(c).forEach((k) => hit.add(k)); });
  const newlyCovered = UNVERIFIED.filter((k) => hit.has(k));
  console.log('\nNEWLY-COVERED unverified lists:', newlyCovered.join(', ') || '(none)');
  console.log('packets saved: /tmp/newrpt-*.json');
  await b.close();
})();
