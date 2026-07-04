/* DEV end-to-end via the REAL SEARCH PATH: search → solve BC captcha → SRP inline signup →
 * create account → payment → submit TEST card (4242, no real money) → confirm purchase.
 * DEV ONLY. CAPTCHA_PW via env (not committed). Usage:
 *   CAPTCHA_PW='…' node scripts/funnel-dev-e2e.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://dev.www.idlookup.ai';
if (!/(^|\.)dev\./.test(new URL(BASE).host)) { console.error('DEV ONLY'); process.exit(1); }
const CAPTCHA_PW = process.env.CAPTCHA_PW || '';
const EMAIL = `qa.e2e.${Math.floor(Date.now()/1000)}@example.com`, PW = 'TestPass12345!', CARD = process.env.TEST_CARD || '4242424242424242';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1100 } })).newPage();
  const log = [], errs = [], reqs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR: ' + String(e.message).slice(0, 140)));
  page.on('response', (r) => { const u = r.url(); if (/teaser|sale|billing|commerce|order/i.test(u)) reqs.push(`${r.status()} ${u.replace(BASE,'').split('?')[0].slice(0,55)}`); });
  const snap = async (t) => { await page.screenshot({ path: `/tmp/e2e-${t}.png`, fullPage: true }); };
  const fillBy = async (rx, val) => { for (const sel of [`input[placeholder*="${rx}" i]`, `input[name*="${rx}" i]`, `input[aria-label*="${rx}" i]`]) { const l = page.locator(sel).first(); if (await l.count()) { await l.fill(val).catch(() => {}); return true; } } return false; };
  async function solveCaptcha() {
    for (let i = 0; i < 8; i++) {
      const has = await page.evaluate(() => /input password/i.test(document.body.innerText));
      if (has) { await page.locator('input[type="password"]').last().fill(CAPTCHA_PW).catch(() => {}); await page.getByRole('button', { name: /confirm|submit|ok/i }).first().click().catch(() => {}); log.push('captcha solved attempt ' + (i + 1)); await page.waitForTimeout(2500); }
      else { await page.waitForTimeout(2000); if (i > 0) break; }
    }
  }

  try {
    // 1) SEARCH
    await page.goto(`${BASE}/name/landing`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(700);
    const inp = page.locator('input');
    await inp.nth(0).fill('John').catch(() => {}); if (await inp.count() > 1) await inp.nth(1).fill('Smith').catch(() => {});
    const sel = page.locator('select').first(); if (await sel.count()) { try { await sel.selectOption({ index: 5 }); } catch {} }
    await page.getByRole('button', { name: /search/i }).first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(3500); await solveCaptcha();
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(2500); if (!/loader/.test(page.url()) || !await page.evaluate(() => /searching|analyzing/i.test(document.body.innerText))) break; }
    log.push('after search → ' + page.url().replace(BASE, ''));
    await snap('1-srp');
    log.push('SRP: ' + (await page.evaluate(() => /results for|unlock full results|create an account/i.test(document.body.innerText))));

    // 2) SRP inline signup
    await page.locator('input[type="email"]').first().fill(EMAIL).catch(() => {});
    await page.locator('input[type="password"]').first().fill(PW).catch(() => {});
    log.push('filled SRP signup: ' + EMAIL);
    await page.getByRole('button', { name: /create account & continue|create account|unlock|continue/i }).first().click().catch((e) => log.push('signup click ' + e.message.slice(0, 50)));
    await page.waitForTimeout(4000); await solveCaptcha(); await page.waitForTimeout(2000);
    log.push('after SRP signup → ' + page.url().replace(BASE, ''));
    await snap('2-after-signup');

    // 3) ensure on payment
    if (!/payment|checkout/i.test(page.url())) { await page.goto(`${BASE}/payment`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}); await page.waitForTimeout(1500); }
    log.push('payment page? ' + (await page.evaluate(() => /membership|payment information|card number/i.test(document.body.innerText))) + ' @ ' + page.url().replace(BASE, ''));
    await fillBy('first', 'Test'); await fillBy('last', 'User');
    (await fillBy('card', CARD)) || (await fillBy('1234', CARD)) || (await fillBy('number', CARD));
    (await fillBy('MM', '12/30')) || (await fillBy('expiry', '12/30'));
    (await fillBy('CVV', '123')) || (await fillBy('CVC', '123')) || (await fillBy('123', '123'));
    (await fillBy('ZIP', '90210')) || (await fillBy('12345', '90210'));
    const cb = page.locator('input[type="checkbox"]').first(); if (await cb.count()) await cb.check().catch(() => {});
    await snap('3-pay-filled');

    // 4) submit
    await page.getByRole('button', { name: /i agree.*continue|continue|pay|submit|unlock/i }).first().click().catch((e) => log.push('pay click ' + e.message.slice(0, 50)));
    for (let i = 0; i < 9; i++) { await page.waitForTimeout(3000); const s = await page.evaluate(() => ({ url: location.pathname, ok: /you'?re in|success|membership is now active|thank you|confirmed/i.test(document.body.innerText), err: /declin|error|failed|invalid|try again|unable/i.test(document.body.innerText) })); log.push(`t+${(i+1)*3}s url=${s.url} success=${s.ok} error=${s.err}`); if (s.ok || s.err) break; }
    await snap('4-result');
    log.push('FINAL: ' + (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 220))));
  } catch (e) { log.push('FATAL: ' + String(e.message).slice(0, 150)); }

  console.log(JSON.stringify({ email: EMAIL, log, apiReqs: reqs.slice(0, 14), pageErrors: errs.slice(0, 8) }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
