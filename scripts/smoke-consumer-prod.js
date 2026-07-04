/* READ-ONLY production smoke for the consumer site (www.idlookup.ai).
 * Loads key routes, records: doc HTTP status (catches SPA deep-link 404s), uncaught
 * page errors (survive the console-strip = real crashes), broken images, white-screen /
 * error-boundary, leaked dev/vendor strings in the DOM, and broken internal links.
 * Does NOT search, submit forms, sign up, or pay. Low volume (one visit per route).
 * Usage: node scripts/smoke-consumer-prod.js   [BASE=https://www.idlookup.ai]
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://www.idlookup.ai';

const ROUTES = [
  '/', '/search', '/search/all',
  '/name/landing', '/phone/landing', '/email/landing',
  '/signup', '/signup/v2', '/login', '/forgot-password', '/payment',
  '/about', '/contact', '/privacy', '/terms', '/refund',
  '/opt-out', '/unsubscribe', '/suppression-list', '/partner',
  '/this-route-should-404',   // sanity: confirms SPA fallback vs hard 404
];

const VENDOR_RX = /ByteCrtrs|CsrWrapper|csrWrapper|\/database\/search|\/contactMessage\/admin|\/commerceMgmt|bcEdgeApiPass|localhost:30\d\d/;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, userAgent: 'IDLookup-smoke-readonly' });
  const results = [];
  const allLinks = new Set();

  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const pageErrors = [], consoleErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
    const r = { route, status: null, title: '', bodyLen: 0, pageErrors, consoleErrors, brokenImgs: 0, vendorLeak: null, whiteScreen: false, errorBoundary: false, err: null };
    try {
      const resp = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
      r.status = resp ? resp.status() : null;
      await page.waitForTimeout(1200);
      r.title = (await page.title()).slice(0, 80);
      const info = await page.evaluate(() => {
        const text = document.body ? document.body.innerText : '';
        const imgs = Array.from(document.images);
        const broken = imgs.filter((i) => i.complete && i.naturalWidth === 0).length;
        const links = Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'));
        const html = document.documentElement.innerHTML;
        return { textLen: text.trim().length, textSample: text.trim().slice(0, 120), broken, links, html };
      });
      r.bodyLen = info.textLen;
      r.brokenImgs = info.broken;
      r.whiteScreen = info.textLen < 30;
      r.errorBoundary = /something went wrong|unexpected error|cannot read propert|is not defined|chunkloaderror/i.test(info.textSample);
      const leak = info.html.match(VENDOR_RX);
      r.vendorLeak = leak ? leak[0] : null;
      info.links.forEach((h) => { if (h && h.startsWith('/')) allLinks.add(h.split('#')[0]); });
    } catch (e) {
      r.err = String(e.message || e).slice(0, 160);
    }
    results.push(r);
    await page.close();
  }

  // Internal-link check (HEAD/GET) — dedupe, skip already-tested routes
  const tested = new Set(ROUTES);
  const linkTargets = [...allLinks].filter((l) => !tested.has(l)).slice(0, 40);
  const linkStatus = [];
  for (const l of linkTargets) {
    const page = await ctx.newPage();
    try { const resp = await page.goto(BASE + l, { waitUntil: 'domcontentloaded', timeout: 20000 }); linkStatus.push({ link: l, status: resp ? resp.status() : null }); }
    catch (e) { linkStatus.push({ link: l, status: 'ERR', err: String(e.message).slice(0, 80) }); }
    await page.close();
  }

  console.log(JSON.stringify({ base: BASE, routes: results, linkTargetsChecked: linkStatus }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
