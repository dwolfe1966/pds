/* Runtime verification of the funnel-delegation fix (name V2 + phone V2).
 * Asserts each wizard now navigates to /name/loader or /phone/loader (it previously
 * went inline to /…/search-result, bypassing the loader's conversion signals).
 * Walks against the LOCAL prod bundle (serve-prod :3000 → dev BC). The loader's own
 * search will captcha-gate on dev, but that's AFTER the navigation we're verifying.
 * Usage: node scripts/verify-funnel-loader.js
 */
const { chromium } = require('@playwright/test');
const BASE = 'http://localhost:3000';

async function walk(page, startPath, expectLoader, fill) {
  const dl = [];
  await page.exposeFunction('__noop', () => {});
  await page.goto(`${BASE}${startPath}`, { waitUntil: 'domcontentloaded' });
  await page.addInitScript(() => {});
  await fill(page); // page-specific first input
  // Generic advance loop: click the primary CTA, tick agree checkbox if present,
  // wait through the artificial 1700ms "searching" steps, until URL hits the loader.
  const deadline = Date.now() + 30000;
  let reached = false;
  while (Date.now() < deadline) {
    if (page.url().includes(expectLoader)) { reached = true; break; }
    // select a state if a dropdown is on the current step (location step needs it)
    const sel = page.locator('select');
    if (await sel.count()) { try { await sel.first().selectOption({ index: 5 }); } catch {} }
    // tick any agree checkbox
    const cb = page.locator('input[type="checkbox"]');
    if (await cb.count()) { try { await cb.first().check({ timeout: 500 }); } catch {} }
    // click the primary advancing button (named match first, else first enabled button)
    let clicked = false;
    const named = page.getByRole('button', { name: /continue|confirm|search|agree|view|next|see|unlock|run|check|reveal|find|look/i }).first();
    if (await named.count()) { try { await named.click({ timeout: 1000 }); clicked = true; } catch {} }
    if (!clicked) {
      const all = page.getByRole('button');
      const n = await all.count();
      for (let i = 0; i < n; i++) {
        const b = all.nth(i);
        if (await b.isEnabled().catch(() => false)) {
          const name = (await b.textContent().catch(() => '') || '').toLowerCase();
          if (/back|skip|cancel|menu|sign in|log/.test(name)) continue;
          try { await b.click({ timeout: 800 }); } catch {}
          break;
        }
      }
    }
    try { await page.keyboard.press('Enter'); } catch {} // submit forms (phone step 1)
    await page.waitForTimeout(1900); // clear the artificial 1700ms "searching" steps
  }
  // capture dataLayer events seen (bonus signal)
  const events = await page.evaluate(() => (window.dataLayer || []).map(e => e && e.event).filter(Boolean));
  return { reached, url: page.url(), events };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();

  console.log('\n== NAME v2 ==');
  const name = await walk(page, '/name/landing/v2', '/name/loader', async (p) => {
    const inputs = p.locator('input[type="text"], input:not([type])');
    await inputs.nth(0).fill('John').catch(() => {});
    if (await inputs.count() > 1) await inputs.nth(1).fill('Smith').catch(() => {});
    const sel = p.locator('select').first();
    if (await sel.count()) { try { await sel.selectOption({ index: 5 }); } catch {} }
  });
  console.log(`  reached /name/loader: ${name.reached}\n  final url: ${name.url}\n  dataLayer events: [${name.events.join(', ')}]`);

  const page2 = await ctx.newPage();
  console.log('\n== PHONE v2 ==');
  const phone = await walk(page2, '/phone/landing/v2', '/phone/loader', async (p) => {
    const inp = p.locator('input').first();
    await inp.fill('2125551234').catch(() => {});
  });
  console.log(`  reached /phone/loader: ${phone.reached}\n  final url: ${phone.url}\n  dataLayer events: [${phone.events.join(', ')}]`);

  console.log(`\n== RESULT: name=${name.reached ? 'PASS' : 'FAIL'} phone=${phone.reached ? 'PASS' : 'FAIL'} ==`);
  await browser.close();
})();
