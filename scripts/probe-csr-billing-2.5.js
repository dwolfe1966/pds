/* Item 2.5 (CSR sale/order creation): BC says use ApiWrapper.api.billing.tokenSale
 * / ApiWrapper.api.billing.sale (the CONSUMER wrapper). This introspects, in the
 * admin context, the billing surface of BOTH wrappers — confirming what exists
 * where. READ-ONLY: does NOT execute any sale (that would create a real order).
 * Creds via env.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;

(async () => {
  if (!USER || !PWD) { console.error('Set CSR_USER and CSR_PWD'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30000);

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    for (const src of ['/libs/api-wrapper/index.iife.js', '/libs/csr-wrapper/index.iife.js']) {
      if ((src.includes('csr') && window.CsrWrapper) || (!src.includes('csr') && window.ApiWrapper)) continue;
      await new Promise((r) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = r; document.head.appendChild(s); });
    }
  });

  const out = await page.evaluate(() => {
    const r = {};
    // CONSUMER ApiWrapper
    try {
      const a = window.ApiWrapper?.getInstance ? window.ApiWrapper.getInstance({ endpointUrl: '/api' }) : window.ApiWrapper;
      r.ApiWrapper_present = !!a;
      r.ApiWrapper_billing_methods = a?.api?.billing ? Object.keys(a.api.billing).filter(k => typeof a.api.billing[k] === 'function') : null;
      r.ApiWrapper_has_sale = typeof a?.api?.billing?.sale === 'function';
      r.ApiWrapper_has_tokenSale = typeof a?.api?.billing?.tokenSale === 'function';
    } catch (e) { r.ApiWrapper_err = e.message; }
    // CSR CsrWrapper
    try {
      const c = window.CsrWrapper?.getInstance ? window.CsrWrapper.getInstance({ endpointUrl: '/api' }) : window.CsrWrapper;
      r.CsrWrapper_present = !!c;
      r.CsrWrapper_has_billing_namespace = !!c?.api?.billing;
      r.CsrWrapper_billing_methods = c?.api?.billing ? Object.keys(c.api.billing) : null;
      r.CsrWrapper_api_namespaces = c?.api ? Object.keys(c.api) : null;
    } catch (e) { r.CsrWrapper_err = e.message; }
    return r;
  });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
