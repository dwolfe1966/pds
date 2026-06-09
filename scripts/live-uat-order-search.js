/* UAT: verify the new CSR "order:<id>" search resolves to the owning customer
 * THROUGH THE WIRED PATH (local build-admin bundle served at :3004, /api proxied
 * to BC). READ-ONLY. CSR creds + a known order id from gitignored scripts/.smoke.env.
 *
 *   npm run build:admin
 *   node scripts/serve-admin-prod.js   # in another shell (or background)
 *   node scripts/live-uat-order-search.js
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(function loadSmokeEnv() {
  const f = path.join(__dirname, '.smoke.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let val = m[2].trim().replace(/^['"‘’“”]|['"‘’“”]$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
})();

const BASE = process.env.LOCAL_ADMIN || 'http://localhost:3004';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
// Known order id + its owner from scripts/verify-bc-csr-params.js (2026-06-09 probe)
const ORDER_ID = process.env.CSR_ORDER_ID || '6a11ea7daaf121809263f98e';
const EXPECT_OWNER = process.env.CSR_ORDER_OWNER || '6a11ea7daaf121809263f972';

(async () => {
  if (!USER || !PWD) { console.log(JSON.stringify({ ran: false, note: 'no CSR creds' })); return; }
  const out = { ran: true, base: BASE, orderId: ORDER_ID, expectOwner: EXPECT_OWNER };
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30000);

  // capture the user.find request our code fires for the order search
  page.on('request', (r) => {
    if (!/\/database\/search/.test(r.url())) return;
    try {
      const b = JSON.parse(r.postData() || '{}');
      if (b?.query?.orderId) out.sentBody = { collectionName: b.collectionName, query: b.query, brandId: b.brandId };
    } catch {}
  });

  // LOGIN
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"], input[name*="email" i], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);
  out.loggedIn = !/\/login/.test(page.url());

  // ORDER SEARCH
  await page.goto(`${BASE}/csr/users`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const sb = page.locator('input[type="search"], input[placeholder*="search" i], input[type="text"]').first();
  await sb.fill(`order:${ORDER_ID}`);
  await sb.press('Enter').catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);

  out.landedUrl = page.url().replace(BASE, '');
  out.landedOnOwner = out.landedUrl.includes(EXPECT_OWNER);
  out.bodySample = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200);
  await page.screenshot({ path: '/tmp/uat-order-search.png', fullPage: true }).catch(() => {});

  // NEGATIVE: a bogus order id should say "no customer found", NOT navigate
  await page.goto(`${BASE}/csr/users`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const sb2 = page.locator('input[type="search"], input[placeholder*="search" i], input[type="text"]').first();
  await sb2.fill('order:ffffffffffffffffffffffff');
  await sb2.press('Enter').catch(() => {});
  await page.waitForTimeout(3500);
  out.bogusUrl = page.url().replace(BASE, '');
  out.bogusStayedOnList = /\/users\/?$/.test(out.bogusUrl);
  out.bogusBody = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200);

  console.log('===== ORDER-SEARCH UAT (wired path) =====');
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
