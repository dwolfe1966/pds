/* PROD funnel, HEADED + human-in-the-loop. Opens a visible browser on this Mac.
 * Automates: search, signup (test email), navigation. HUMAN does: Turnstile, real card + submit.
 * Captures the GTM dataLayer at every stage (answers "are GTM params pushed on each screen change?").
 * Real $1 charge happens only when the USER clicks the final submit. Usage:
 *   node scripts/funnel-prod-headed.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://www.idlookup.ai';
const EMAIL = process.env.TEST_EMAIL || `qa.prod.${Math.floor(Date.now()/1000)}@example.com`, PW = 'TestPass12345!';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const page = await (await browser.newContext({ viewport: { width: 1340, height: 1000 } })).newPage();
  const log = [], reqs = [];
  page.on('response', (r) => { const u = r.url(); if (/teaser|sale|billing|commerce|order|auth/i.test(u)) reqs.push(`${r.status()} ${u.replace(BASE,'').split('?')[0].slice(0,50)}`); });
  const banner = (m) => { console.log('\n============================================================\n  ' + m + '\n============================================================\n'); log.push('>>> ' + m); };
  const dl = async (stage) => {
    const d = await page.evaluate(() => { try { return (window.dataLayer || []).map((e) => (e && e.event) ? e.event : (Array.isArray(e) ? String(e[0]) : Object.keys(e || {}).slice(0, 2).join('+'))); } catch (e) { return ['ERR']; } });
    log.push(`GTM dataLayer @ ${stage} — count=${d.length} events=[${d.join(', ')}]`);
    console.log(`GTM @ ${stage}: count=${d.length} :: ${d.join(' | ')}`);
  };
  const snap = async (t) => { await page.screenshot({ path: `/tmp/prod-${t}.png`, fullPage: true }).catch(() => {}); };
  const waitFor = async (predicate, label, timeoutMs) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) { try { if (await page.evaluate(predicate)) return true; } catch {} await page.waitForTimeout(1500); }
    log.push('TIMEOUT waiting for: ' + label); return false;
  };

  try {
    await page.goto(`${BASE}/name/landing`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    await dl('landing'); await snap('1-landing');

    const inp = page.locator('input');
    await inp.nth(0).fill('John').catch(() => {}); if (await inp.count() > 1) await inp.nth(1).fill('Smith').catch(() => {});
    const sel = page.locator('select').first(); if (await sel.count()) { try { await sel.selectOption({ index: 5 }); } catch {} }
    await page.getByRole('button', { name: /search/i }).first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await dl('loader (after search)'); await snap('2-loader');

    banner('ACTION 1 → In the browser window, complete the "Verify you are human" box. (Waiting up to 4 min.)');
    const reachedSRP = await waitFor(() => /results for|unlock full results|create an account/i.test(document.body.innerText), 'SRP results', 240000);
    log.push('reached SRP: ' + reachedSRP + ' @ ' + page.url().replace(BASE, ''));
    await dl('SRP (results)'); await snap('3-srp');

    if (reachedSRP) {
      await page.locator('input[type="email"]').first().fill(EMAIL).catch(() => {});
      await page.locator('input[type="password"]').first().fill(PW).catch(() => {});
      log.push('auto-filled signup: ' + EMAIL);
      await page.getByRole('button', { name: /create account & continue|create account|unlock|continue/i }).first().click().catch(() => {});
      await page.waitForTimeout(4000);
      await dl('after signup');
      if (!/payment|checkout/i.test(page.url())) { await page.goto(`${BASE}/payment`, { waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(1500); }
      await dl('payment page'); await snap('4-payment');

      banner('ACTION 2 → Enter your REAL card and click "I Agree, Continue". This is the live $1 charge. (Waiting up to 5 min.)');
      const done = await waitFor(() => /you'?re in|membership is now active|thank you|success|declin|error|failed|invalid|unable/i.test(document.body.innerText), 'payment outcome', 300000);
      await dl('after payment'); await snap('5-result');
      const fin = await page.evaluate(() => ({ url: location.pathname, txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260) }));
      log.push('PAYMENT OUTCOME @ ' + fin.url + ' :: ' + fin.txt);
    }
  } catch (e) { log.push('FATAL: ' + String(e.message).slice(0, 160)); }

  console.log('\n\n===== RESULT =====');
  console.log(JSON.stringify({ email: EMAIL, apiReqs: reqs, log }, null, 2));
  banner('Done. Leaving the browser open 30s so you can see the final state.');
  await page.waitForTimeout(30000);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
