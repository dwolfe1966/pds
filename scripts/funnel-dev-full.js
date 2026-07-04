/* End-to-end consumer funnel on DEV: search → solve BC password-captcha → results →
 * proceed to signup → create dev account → reach payment. DEV ONLY (dev-host-gated captcha
 * password). Screenshots every stage. Stops at payment and reports what it requires (does NOT
 * auto-submit a charge unless a test card is provided + ALLOW_PAY=1).
 * Usage: node scripts/funnel-dev-full.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://dev.www.idlookup.ai';
const isDev = /(^|\.)dev\./.test(new URL(BASE).host);
const CAPTCHA_PW = process.env.CAPTCHA_PW || (isDev ? 'bcEdgeApiPass123!@#' : '');
const TEST_EMAIL = process.env.TEST_EMAIL || `qa.smoke.${Math.floor(Date.now()/1000)}@example.com`;
const TEST_PW = 'TestPass12345!';
const TEST_CARD = process.env.TEST_CARD || ''; // only used if ALLOW_PAY=1
const ALLOW_PAY = process.env.ALLOW_PAY === '1';

(async () => {
  if (!isDev && !process.env.CAPTCHA_PW) { console.error('Refusing default dev password on non-dev host'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  const log = [], errs = [], failed = [];
  page.on('pageerror', (e) => errs.push('PAGEERR: ' + String(e.message).slice(0, 150)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 120)); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(BASE,'').slice(0, 80)}`); });
  const snap = async (t) => { await page.screenshot({ path: `/tmp/ff-${t}.png`, fullPage: true }); log.push(`shot ff-${t} @ ${page.url().replace(BASE,'')}`); };
  const txt = async () => (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))).slice(0, 220);

  // solve the BC "Input Password" modal if present
  async function solveCaptcha(tag) {
    for (let i = 0; i < 10; i++) {
      const pwField = page.locator('input[type="password"]');
      const hasModal = await page.evaluate(() => /input password/i.test(document.body.innerText));
      if (hasModal && await pwField.count()) {
        await pwField.last().fill(CAPTCHA_PW).catch(() => {});
        await page.getByRole('button', { name: /confirm|submit|ok/i }).first().click().catch(() => {});
        log.push(`solved captcha (${tag}) attempt ${i + 1}`);
        await page.waitForTimeout(2500);
      } else { await page.waitForTimeout(2500); }
      const done = await page.evaluate(() => !/input password/i.test(document.body.innerText));
      if (done && i > 0) break;
    }
  }

  try {
    // 1) search
    await page.goto(`${BASE}/name/landing`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    const inputs = page.locator('input');
    await inputs.nth(0).fill('John').catch(() => {});
    if (await inputs.count() > 1) await inputs.nth(1).fill('Smith').catch(() => {});
    const sel = page.locator('select').first();
    if (await sel.count()) { try { await sel.selectOption({ index: 5 }); } catch {} }
    await page.getByRole('button', { name: /search/i }).first().click({ timeout: 10000 }).catch(() => {});
    log.push('searched → ' + page.url().replace(BASE, ''));
    await page.waitForTimeout(4000);
    await snap('1-loader');

    // 2) solve captcha, wait for results
    await solveCaptcha('search');
    let landed = '';
    for (let i = 0; i < 14; i++) {
      await page.waitForTimeout(3000);
      await solveCaptcha('poll' + i);
      const u = page.url();
      const st = await page.evaluate(() => ({ loading: /searching|analyzing/i.test(document.body.innerText), zero: /no (results|records|matches)/i.test(document.body.innerText) }));
      log.push(`t+${(i+1)*3}s ${u.replace(BASE,'')} loading=${st.loading} zero=${st.zero}`);
      if (st.zero) { landed = 'ZERO'; break; }
      if (!st.loading && (/result/.test(u) || !/loader/.test(u))) { landed = 'RESULTS'; break; }
    }
    log.push('after search: ' + landed + ' @ ' + page.url().replace(BASE, ''));
    await snap('2-results');
    log.push('results text: ' + await txt());

    // 3) proceed toward signup/paywall — click a likely CTA
    const ctaRx = /view (report|profile|details)|see (full|more|report)|unlock|get (report|access)|sign ?up|create account|continue/i;
    const cta = page.getByRole('button', { name: ctaRx }).first();
    const ctaLink = page.getByRole('link', { name: ctaRx }).first();
    if (await cta.count()) { await cta.click().catch(() => {}); log.push('clicked CTA button'); }
    else if (await ctaLink.count()) { await ctaLink.click().catch(() => {}); log.push('clicked CTA link'); }
    else { log.push('no obvious CTA found on results'); }
    await page.waitForTimeout(3500);
    await solveCaptcha('post-cta');
    await page.waitForTimeout(2000);
    log.push('after CTA → ' + page.url().replace(BASE, ''));
    await snap('3-after-cta');
    log.push('page text: ' + await txt());

    // 4) signup if we're on a signup/account page
    if (/signup|account|register/i.test(page.url()) || await page.evaluate(() => /create your account/i.test(document.body.innerText))) {
      await page.locator('input[type="email"], input[placeholder*="example" i]').first().fill(TEST_EMAIL).catch(() => {});
      await page.locator('input[type="password"]').first().fill(TEST_PW).catch(() => {});
      const phone = page.locator('input[placeholder*="555" i], input[type="tel"]').first();
      if (await phone.count()) await phone.fill('2125550100').catch(() => {});
      log.push('filled signup: ' + TEST_EMAIL);
      await snap('4-signup-filled');
      await page.getByRole('button', { name: /create my account|sign ?up|create account|continue/i }).first().click().catch(() => {});
      await page.waitForTimeout(4000);
      await solveCaptcha('signup');
      await page.waitForTimeout(2000);
      log.push('after signup submit → ' + page.url().replace(BASE, ''));
      await snap('5-after-signup');
      log.push('page text: ' + await txt());
    } else { log.push('did not reach signup page; stopping before signup'); }

    // 5) payment page inspection
    if (/payment|checkout|billing/i.test(page.url()) || await page.evaluate(() => /payment|card number|credit card|\$1/i.test(document.body.innerText))) {
      await snap('6-payment');
      const pay = await page.evaluate(() => {
        const fields = Array.from(document.querySelectorAll('input,iframe')).map((e) => e.tagName + (e.name || e.placeholder || e.title || e.id ? ':' + (e.name || e.placeholder || e.title || e.id) : '')).slice(0, 20);
        return { text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 300), fields };
      });
      log.push('PAYMENT fields: ' + JSON.stringify(pay.fields));
      log.push('PAYMENT text: ' + pay.text);
      if (ALLOW_PAY && TEST_CARD) {
        log.push('ALLOW_PAY set — (card entry would go here)');
      } else {
        log.push('STOP at payment (no ALLOW_PAY/TEST_CARD) — reporting what it requires.');
      }
    } else { log.push('did not reach a payment page'); }
  } catch (e) { log.push('FATAL: ' + String(e.message).slice(0, 160)); }

  console.log(JSON.stringify({ base: BASE, testEmail: TEST_EMAIL, log, pageErrors: errs.slice(0, 12), failedReq: failed.slice(0, 12) }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
