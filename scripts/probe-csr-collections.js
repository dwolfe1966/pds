/* After BC's permission relaxation: verify /database/search works for EVERY
 * collection the CSR app needs (not just users). Logs in, then POSTs the same
 * call the app makes for each collection, reports status + row count.
 * Creds via env (CSR_USER / CSR_PWD), never committed. READ-ONLY.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;

// collection → the body the corresponding csr* method sends (brandId where the app sends it)
const CASES = [
  { feature: 'Customer search', body: { brandId: 'idlookup', collectionName: 'users', query: {}, perPage: 3 } },
  { feature: 'CSR reps',        body: { brandId: 'idlookup', collectionName: 'users', isAdmin: true, perPage: 3 } },
  { feature: 'Global orders',   body: { brandId: 'idlookup', collectionName: 'commerceOrder', perPage: 3 } },
  { feature: 'Data removal',    body: { brandId: 'idlookup', collectionName: 'optOutRequest', perPage: 3 } },
  { feature: 'Unsubscribe',     body: { collectionName: 'managedContact', type: 'email', perPage: 3 } },
  { feature: 'Notes/contacts',  body: { collectionName: 'userContact', perPage: 3 } },
  { feature: 'Visitor contacts',body: { collectionName: 'contact', perPage: 3 } },
  { feature: 'Tracking',        body: { collectionName: 'trackings', perPage: 3 } },
];

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);

  let loginQs = '';
  page.on('response', (res) => {
    const u = res.url();
    if (/auth\/login/i.test(u) && res.request().method() === 'POST' && u.includes('?')) loginQs = u.slice(u.indexOf('?'));
  });

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);

  const results = [];
  for (const c of CASES) {
    const r = await page.evaluate(async ({ qs, body }) => {
      try {
        const res = await fetch(`/api/database/search${qs}`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        let j; try { j = await res.json(); } catch { j = null; }
        const rows = j && (Array.isArray(j) ? j : (j.docs || j.data || j.results));
        return { status: res.status, rows: Array.isArray(rows) ? rows.length : null,
                 msg: j && j.message ? j.message : null };
      } catch (e) { return { thrown: e.message }; }
    }, { qs: loginQs, body: c.body });
    results.push({ feature: c.feature, collection: c.body.collectionName, ...r });
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
