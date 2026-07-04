/* DEV: test DIRECT signup (no search needed) → where it routes → payment.
 * Does account creation hit the captcha wall too, or proceed? Creates a throwaway DEV account.
 * Stops before any real charge. Usage: node scripts/funnel-dev-signup.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://dev.www.idlookup.ai';
const EMAIL = process.env.TEST_EMAIL || `qa.smoke.${Math.floor(Date.now()/1000)}@example.com`;
const PW = 'TestPass12345!';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  const log = [], errs = [], failed = [];
  page.on('pageerror', (e) => errs.push('PAGEERR: ' + String(e.message).slice(0, 150)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 120)); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(BASE,'').slice(0,70)}`); });
  const snap = async (t) => { await page.screenshot({ path: `/tmp/su-${t}.png`, fullPage: true }); };
  const seen = async () => page.evaluate(() => ({
    url: location.pathname + location.search,
    captchaModal: /input password/i.test(document.body.innerText),
    captchaFail: /captcha verification failed/i.test(document.body.innerText),
    text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 220),
  }));

  try {
    await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    await page.locator('input[type="email"], input[placeholder*="example" i]').first().fill(EMAIL).catch(() => {});
    await page.locator('input[type="password"]').first().fill(PW).catch(() => {});
    const phone = page.locator('input[placeholder*="555" i], input[type="tel"]').first();
    if (await phone.count()) await phone.fill('2125550100').catch(() => {});
    log.push('signup filled: ' + EMAIL);
    await snap('1-filled');

    await page.getByRole('button', { name: /create my account|sign ?up|create account/i }).first().click().catch((e) => log.push('click ' + e.message.slice(0, 50)));
    log.push('clicked create account');
    // observe over ~25s (captcha? navigation? error?)
    for (let i = 0; i < 8; i++) {
      await page.waitForTimeout(3000);
      const s = await seen();
      log.push(`t+${(i+1)*3}s url=${s.url} captchaModal=${s.captchaModal} captchaFail=${s.captchaFail}`);
      if (s.captchaModal || s.captchaFail) { log.push('CAPTCHA WALL on signup'); break; }
      if (/payment|checkout/i.test(s.url)) { log.push('REACHED PAYMENT'); break; }
      if (/dashboard|people|account|welcome|verify/i.test(s.url)) { log.push('post-signup route: ' + s.url); break; }
    }
    await snap('2-after');
    const fin = await seen();
    log.push('FINAL url=' + fin.url);
    log.push('FINAL text: ' + fin.text);

    // if landed somewhere logged-in, try to reach payment
    if (/dashboard|account|people|welcome/i.test(fin.url)) {
      // look for an unlock/upgrade/report CTA
      const cta = page.getByRole('button', { name: /unlock|upgrade|view report|get (report|access)|see (full|report)|start trial|continue/i }).first();
      const ctaL = page.getByRole('link', { name: /unlock|upgrade|view report|payment|billing|plan|start trial/i }).first();
      if (await cta.count()) { await cta.click().catch(() => {}); log.push('clicked upgrade CTA'); }
      else if (await ctaL.count()) { await ctaL.click().catch(() => {}); log.push('clicked upgrade link'); }
      await page.waitForTimeout(3000);
      const s2 = await seen();
      log.push('after upgrade attempt url=' + s2.url);
      await snap('3-upgrade');
    }
  } catch (e) { log.push('FATAL: ' + String(e.message).slice(0, 150)); }

  console.log(JSON.stringify({ base: BASE, email: EMAIL, log, pageErrors: errs.slice(0, 10), failedReq: failed.slice(0, 10) }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
