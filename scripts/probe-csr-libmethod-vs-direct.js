/* Disambiguate the CSR /database/search 403: is it PERMISSION (account can't read
 * the collection) or ACCESS-METHOD (BC closed direct endpoint POSTs, requires the
 * IIFE lib method)? Logs in, then runs BOTH the IIFE lib method (csr.api.user.find)
 * and the hand-rolled direct POST against the same authenticated session, compares.
 * Creds via env (CSR_USER / CSR_PWD), never committed. READ-ONLY.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);

  // Watch every /database/search response + its status, tag the caller via a header we set.
  const net = [];
  page.on('response', async (res) => {
    if (/database\/search/i.test(res.url())) {
      net.push({ status: res.status(), via: res.request().headers()['x-probe-via'] || '?' });
    }
  });

  // LOGIN
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);

  // Make sure the CSR IIFE is available in-page.
  const wrapperState = await page.evaluate(async () => {
    async function ensure() {
      if (window.CsrWrapper) return 'preloaded';
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = '/libs/csr-wrapper/index.iife.js';
          s.onload = resolve; s.onerror = () => reject(new Error('load fail'));
          document.head.appendChild(s);
        });
        return window.CsrWrapper ? 'loaded' : 'loaded-but-absent';
      } catch (e) { return 'load-error:' + e.message; }
    }
    return await ensure();
  });

  // (A) LIB METHOD: csr.api.user.find
  const libResult = await page.evaluate(async () => {
    try {
      if (!window.CsrWrapper) return { error: 'no CsrWrapper' };
      const csr = typeof window.CsrWrapper.getInstance === 'function'
        ? window.CsrWrapper.getInstance({ endpointUrl: '/api' }) : window.CsrWrapper;
      const fn = csr?.api?.user?.find;
      if (typeof fn !== 'function') return { error: 'api.user.find not a function', keys: Object.keys(csr?.api?.user || {}) };
      const res = await fn.call(csr.api.user, { brandId: 'idlookup', collectionName: 'users', query: {}, perPage: 5 });
      const err = res?.getError ? res.getError() : null;
      const data = res?.getData ? res.getData() : res;
      return {
        hadError: !!err,
        errStatus: err?.response?.status ?? null,
        errMsg: err?.response?.data?.message || err?.message || null,
        dataType: Array.isArray(data) ? `array(${data.length})` : typeof data,
        dataKeys: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data).slice(0, 8) : null,
      };
    } catch (e) { return { thrown: e.message }; }
  });

  // (B) DIRECT POST (what csrFindUsers does today), tagged so we can see its status.
  const directResult = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/database/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-probe-via': 'direct' },
        credentials: 'include',
        body: JSON.stringify({ brandId: 'idlookup', collectionName: 'users', query: {}, perPage: 5 }),
      });
      let body; try { body = await res.json(); } catch { body = await res.text(); }
      return { status: res.status, sample: (typeof body === 'string' ? body : JSON.stringify(body)).slice(0, 200) };
    } catch (e) { return { thrown: e.message }; }
  });

  console.log(JSON.stringify({ wrapperState, libMethod_userFind: libResult, directPost: directResult, databaseSearchResponses: net }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
