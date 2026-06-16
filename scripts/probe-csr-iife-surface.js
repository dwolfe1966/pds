/* Enumerate the ACTUAL method surface of the deployed csrWrapper IIFE
 * (window.CsrWrapper.api.*) — ground truth for "which lib methods exist",
 * since the csrApi docs run ahead of the shipped bundle. Logs in first so
 * getInstance is realistic. Creds via env. READ-ONLY.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);

  const surface = await page.evaluate(() => {
    if (!window.CsrWrapper) return { error: 'no CsrWrapper' };
    const csr = typeof window.CsrWrapper.getInstance === 'function'
      ? window.CsrWrapper.getInstance({ endpointUrl: '/api' }) : window.CsrWrapper;
    const api = csr && csr.api;
    if (!api) return { error: 'no csr.api', csrKeys: Object.keys(csr || {}) };
    // walk one level of namespaces, list function names on each
    const tree = {};
    const fnNames = (obj) => {
      const names = new Set();
      let o = obj;
      while (o && o !== Object.prototype) {
        for (const k of Object.getOwnPropertyNames(o)) {
          if (k === 'constructor') continue;
          try { if (typeof obj[k] === 'function') names.add(k); } catch {}
        }
        o = Object.getPrototypeOf(o);
      }
      return [...names].sort();
    };
    for (const ns of Object.keys(api)) {
      const node = api[ns];
      if (node && typeof node === 'object') {
        const sub = {};
        for (const k of Object.keys(node)) {
          if (node[k] && typeof node[k] === 'object') sub[k] = fnNames(node[k]);
        }
        tree[ns] = { methods: fnNames(node), subNamespaces: sub };
      } else if (typeof node === 'function') {
        tree[ns] = 'function';
      }
    }
    return tree;
  });

  console.log(JSON.stringify(surface, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
