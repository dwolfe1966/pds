/* Drive the consumer funnel on DEV (dev.www.idlookup.ai) — search → results.
 * Screenshots each stage; reports console/page errors, network failures, Turnstile presence,
 * and the result/paywall state. Stage 1 of the end-to-end (signup/payment follow separately).
 * Usage: node scripts/funnel-dev.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://dev.www.idlookup.ai';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  const errs = [], failed = [];
  page.on('pageerror', (e) => errs.push('PAGEERR: ' + String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 140)); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().slice(0, 90)}`); });
  const stages = [];
  const snap = async (tag) => { await page.screenshot({ path: `/tmp/funnel-${tag}.png`, fullPage: true }); stages.push(`shot ${tag} @ ${page.url().replace(BASE,'')}`); };

  try {
    await page.goto(`${BASE}/name/landing`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    stages.push('landing: ' + (await page.title()) + ' @ ' + page.url().replace(BASE, ''));
    await snap('1-landing');

    // fill name + state
    const inputs = page.locator('input');
    await inputs.nth(0).fill('John').catch(() => {});
    if (await inputs.count() > 1) await inputs.nth(1).fill('Smith').catch(() => {});
    const sel = page.locator('select').first();
    if (await sel.count()) { try { await sel.selectOption({ index: 5 }); } catch {} }
    stages.push('filled name form');

    await page.getByRole('button', { name: /search/i }).first().click({ timeout: 10000 }).catch((e) => stages.push('click err ' + e.message.slice(0, 60)));
    await page.waitForTimeout(2000);
    stages.push('after click → ' + page.url().replace(BASE, ''));
    await snap('2-afterclick');

    // poll up to ~40s for results / paywall / turnstile
    let state = 'unknown';
    for (let i = 0; i < 13; i++) {
      await page.waitForTimeout(3000);
      const info = await page.evaluate(() => {
        const t = document.body.innerText;
        const hasTurnstile = !!document.querySelector('iframe[src*="challenges.cloudflare"], iframe[title*="Cloudflare" i], iframe[title*="human" i]');
        return { url: location.pathname + location.search, turnstile: hasTurnstile, hasResults: /result|found|match|select|view (report|profile)|unlock|see (full|more)/i.test(t), zero: /no (results|records|matches) found/i.test(t), loading: /searching|analyzing|loading/i.test(t), sample: t.replace(/\s+/g, ' ').slice(0, 160) };
      });
      stages.push(`t+${(i+1)*3}s url=${info.url} turnstile=${info.turnstile} results=${info.hasResults} zero=${info.zero} loading=${info.loading}`);
      if (info.turnstile) { state = 'TURNSTILE'; break; }
      if (info.zero) { state = 'ZERO_RESULTS'; break; }
      if (!info.loading && info.url.includes('result')) { state = 'RESULTS'; break; }
      if (info.url.includes('/people') || info.url.includes('/payment') || info.url.includes('/signup')) { state = 'PAST_RESULTS:' + info.url; break; }
    }
    stages.push('FINAL STATE: ' + state);
    await snap('3-final');
    stages.push('bodySample: ' + (await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 240))));
  } catch (e) { stages.push('FATAL: ' + String(e.message).slice(0, 160)); }

  console.log(JSON.stringify({ base: BASE, stages, pageErrors: errs.slice(0, 15), failedReq: failed.slice(0, 15) }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
