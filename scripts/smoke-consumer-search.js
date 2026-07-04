/* READ-ONLY: exercise ONE name-search funnel on prod to verify search → loader → SRP/paywall.
 * A search is a GET (teaser is the free lead-gen step). NO signup, NO payment. Single search.
 * Captures console/page errors + screenshots each stage. Screenshots stay in /tmp (real PII — not committed).
 * Usage: node scripts/smoke-consumer-search.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://www.idlookup.ai';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR: ' + String(e.message).slice(0, 160)));
  const stages = [];
  const log = (s) => { stages.push(`${Date.now() % 100000} ${s}`); };

  try {
    await page.goto(`${BASE}/name/landing`, { waitUntil: 'networkidle', timeout: 30000 });
    log('landing loaded: ' + (await page.title()));
    // fill the name form (common name → has results; generic to limit PII specificity)
    await page.locator('input').first().fill('John').catch(() => {});
    const inputs = page.locator('input');
    const n = await inputs.count();
    if (n > 1) await inputs.nth(1).fill('Smith').catch(() => {});
    // state dropdown if present
    const sel = page.locator('select').first();
    if (await sel.count()) { try { await sel.selectOption({ index: 5 }); } catch {} }
    log(`form filled (inputs=${n})`);
    await page.screenshot({ path: '/tmp/search-1-filled.png', fullPage: true });

    // click the search button
    const btn = page.getByRole('button', { name: /search/i }).first();
    await btn.click({ timeout: 10000 }).catch((e) => log('search click err: ' + e.message.slice(0, 80)));
    log('clicked search → ' + page.url());
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/search-2-afterclick.png', fullPage: true });
    log('after 3s: url=' + page.url());

    // wait for navigation/results to settle (loader → SRP)
    await page.waitForTimeout(8000);
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 400));
    const hasCaptcha = /captcha|verify you|robot|i'm not a robot/i.test(bodyText) || (await page.locator('iframe[src*="captcha" i], iframe[title*="captcha" i]').count()) > 0;
    log('settled: url=' + page.url() + ' captcha=' + hasCaptcha);
    await page.screenshot({ path: '/tmp/search-3-result.png', fullPage: true });
    log('bodySample: ' + bodyText.replace(/\s+/g, ' ').slice(0, 200));
  } catch (e) {
    log('FATAL: ' + String(e.message).slice(0, 160));
  }

  console.log(JSON.stringify({ stages, pageErrors: errs }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
