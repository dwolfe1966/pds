/* AGGRESSIVE read-only audit of www.idlookup.ai. NO searches (loaders excluded — they hit BC),
 * NO form submits to BC, NO signup/payment. Per route captures: doc HTTP status, final URL,
 * <title>, meta description, H1, real <a href> count, failed network requests (>=400/blocked),
 * uncaught page errors, console errors, broken images, images missing alt, inputs missing labels,
 * vendor/dev leaks. Then status-checks EVERY collected link (internal + external).
 * Usage: node scripts/audit-consumer-aggressive.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://www.idlookup.ai';

const ROUTES = [
  '/', '/search', '/search/all', '/about', '/contact',
  '/signup', '/signup/v2', '/login', '/forgot-password', '/payment',
  '/privacy', '/terms', '/refund', '/opt-out', '/unsubscribe', '/suppression-list', '/partner',
  '/name/landing', '/name/landing/v2', '/name/landing/v3', '/name/landing/v4', '/name/landing/v5', '/name/landing/v6', '/name/signup',
  '/phone/landing', '/phone/landing/v2', '/phone/landing/v3', '/phone/landing/v4', '/phone/landing/v5', '/phone/landing/v6',
  '/email/landing', '/email/landing/v2', '/email/landing/v3', '/email/landing/v4', '/email/landing/v5', '/email/landing/v6',
];
const VENDOR_RX = /ByteCrtrs|CsrWrapper|csrWrapper|\/database\/search|\/contactMessage\/admin|\/commerceMgmt|bcEdgeApiPass/;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const results = [];
  const links = new Set();

  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const pageErrors = [], consoleErrors = [], failedReq = [];
    page.on('pageerror', (e) => pageErrors.push(String(e.message || e).slice(0, 160)));
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 140)); });
    page.on('response', (resp) => { const s = resp.status(); if (s >= 400) failedReq.push(`${s} ${resp.url().replace(BASE, '').slice(0, 90)}`); });
    page.on('requestfailed', (req) => failedReq.push(`FAIL ${req.url().replace(BASE, '').slice(0, 90)} (${req.failure()?.errorText || ''})`));
    const r = { route, status: null, finalUrl: '', title: '', metaDesc: '', h1: '', anchors: 0, pageErrors, consoleErrors, failedReq, brokenImgs: 0, imgsNoAlt: 0, inputsNoLabel: 0, vendorLeak: null, err: null };
    try {
      const resp = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
      r.status = resp ? resp.status() : null;
      await page.waitForTimeout(1000);
      r.finalUrl = page.url().replace(BASE, '');
      r.title = await page.title();
      const info = await page.evaluate(() => {
        const md = document.querySelector('meta[name="description"]');
        const imgs = Array.from(document.images);
        const inputs = Array.from(document.querySelectorAll('input,select,textarea')).filter((e) => e.type !== 'hidden');
        const labeled = (el) => !!(el.getAttribute('aria-label') || el.getAttribute('placeholder') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label'));
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return {
          metaDesc: md ? (md.getAttribute('content') || '') : '',
          h1: (document.querySelector('h1')?.innerText || '').slice(0, 60),
          anchors: anchors.length,
          hrefs: anchors.map((a) => a.href),
          broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
          noAlt: imgs.filter((i) => !i.getAttribute('alt')).length,
          inputsNoLabel: inputs.filter((e) => !labeled(e)).length,
          html: document.documentElement.innerHTML,
        };
      });
      r.metaDesc = info.metaDesc.slice(0, 60);
      r.h1 = info.h1;
      r.anchors = info.anchors;
      r.brokenImgs = info.broken;
      r.imgsNoAlt = info.noAlt;
      r.inputsNoLabel = info.inputsNoLabel;
      const leak = info.html.match(VENDOR_RX);
      r.vendorLeak = leak ? leak[0] : null;
      info.hrefs.forEach((h) => links.add(h));
    } catch (e) { r.err = String(e.message || e).slice(0, 140); }
    results.push(r);
    await page.close();
  }

  // status-check every collected link
  const linkList = [...links].filter((l) => /^https?:/.test(l)).slice(0, 120);
  const linkStatus = [];
  for (const l of linkList) {
    const page = await ctx.newPage();
    try { const resp = await page.goto(l, { waitUntil: 'commit', timeout: 15000 }); linkStatus.push({ link: l.replace(BASE, ''), status: resp ? resp.status() : null }); }
    catch (e) { linkStatus.push({ link: l.replace(BASE, ''), status: 'ERR', err: String(e.message).slice(0, 60) }); }
    await page.close();
  }

  console.log(JSON.stringify({ base: BASE, routeCount: results.length, routes: results, links: linkStatus }, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
