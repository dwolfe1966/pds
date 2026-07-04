/* DEV ONLY: full funnel WITHOUT search — signup → /payment → submit a TEST card (4242…, not a
 * real card, no real money) → observe whether the $1 trial purchase completes + account upgrades.
 * This is the canonical pre-launch checkout test on the dev/sandbox backend.
 * Usage: node scripts/funnel-dev-pay-submit.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://dev.www.idlookup.ai';
if (!/(^|\.)dev\./.test(new URL(BASE).host)) { console.error('DEV ONLY'); process.exit(1); }
const EMAIL = `qa.pay.${Math.floor(Date.now()/1000)}@example.com`, PW = 'TestPass12345!';
const CARD = process.env.TEST_CARD || '4242424242424242';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1100 } })).newPage();
  const log = [], errs = [], reqs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR: ' + String(e.message).slice(0, 150)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 120)); });
  page.on('response', (r) => { const u = r.url(); if (/sale|billing|commerce|order/i.test(u)) reqs.push(`${r.status()} ${u.replace(BASE,'').split('?')[0].slice(0,60)}`); });
  const fillBy = async (rx, val) => { for (const sel of [`input[placeholder*="${rx}" i]`, `input[name*="${rx}" i]`, `input[aria-label*="${rx}" i]`]) { const l = page.locator(sel).first(); if (await l.count()) { await l.fill(val).catch(() => {}); return true; } } return false; };

  try {
    // signup
    await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(700);
    await page.locator('input[type="email"]').first().fill(EMAIL).catch(() => {});
    await page.locator('input[type="password"]').first().fill(PW).catch(() => {});
    await page.getByRole('button', { name: /create my account|sign ?up/i }).first().click().catch(() => {});
    await page.waitForTimeout(4000);
    log.push('signed up → ' + page.url().replace(BASE, ''));

    // payment
    await page.goto(`${BASE}/payment`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    log.push('on payment: ' + (await page.evaluate(() => /membership|unlock|payment information/i.test(document.body.innerText))));
    // fill card form
    const fname = await fillBy('first', 'Test'); const lname = await fillBy('last', 'User');
    const card = (await fillBy('card', CARD)) || (await fillBy('1234', CARD)) || (await fillBy('number', CARD));
    const exp = (await fillBy('MM', '12/30')) || (await fillBy('expiry', '12/30')) || (await fillBy('YY', '12/30'));
    const cvv = (await fillBy('CVV', '123')) || (await fillBy('CVC', '123')) || (await fillBy('123', '123'));
    const zip = (await fillBy('ZIP', '90210')) || (await fillBy('12345', '90210'));
    log.push(`filled card form: fname=${fname} lname=${lname} card=${card} exp=${exp} cvv=${cvv} zip=${zip}`);
    // consent checkbox if any
    const cb = page.locator('input[type="checkbox"]').first(); if (await cb.count()) await cb.check().catch(() => {});
    await page.screenshot({ path: '/tmp/paysub-1-filled.png', fullPage: true });

    // submit
    await page.getByRole('button', { name: /i agree.*continue|continue|pay|submit|unlock/i }).first().click().catch((e) => log.push('submit click ' + e.message.slice(0, 60)));
    log.push('clicked submit');
    for (let i = 0; i < 9; i++) {
      await page.waitForTimeout(3000);
      const s = await page.evaluate(() => ({ url: location.pathname, ok: /you'?re in|success|welcome|thank you|confirmed|active|paid/i.test(document.body.innerText), err: /declin|error|failed|invalid|try again|406|unable/i.test(document.body.innerText), txt: document.body.innerText.replace(/\s+/g, ' ').slice(0, 200) }));
      log.push(`t+${(i+1)*3}s url=${s.url} success=${s.ok} error=${s.err}`);
      if (s.ok) { log.push('PURCHASE SUCCESS :: ' + s.txt); break; }
      if (s.err) { log.push('PURCHASE ERROR :: ' + s.txt); break; }
    }
    await page.screenshot({ path: '/tmp/paysub-2-result.png', fullPage: true });
  } catch (e) { log.push('FATAL: ' + String(e.message).slice(0, 150)); }

  console.log(JSON.stringify({ email: EMAIL, log, billingReqs: reqs.slice(0, 12), pageErrors: errs.slice(0, 10) }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
