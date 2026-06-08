/* Verify whether BC now honors the newly-documented server-side params (csrApi
 * update 2026-06-08): tracking.findUser `updaterId` and user.find `orderId`.
 * READ-ONLY. CSR creds from gitignored scripts/.smoke.env (CSR_USER/CSR_PWD).
 *
 * Method: log into the CSR app, open a known user detail (which triggers our
 * csrFindUserTracking → direct POST /database/search with updaterId). Intercept the
 * trackings response and check if EVERY returned doc's updaterId === the target user
 * (server-side scoped) or mixed (not honored — current stopgap client-filter still
 * needed). Then capture the session's apiId/clientId and replay a user.find with an
 * orderId to see if BC resolves it to the owning user.
 * Usage: node scripts/verify-bc-csr-params.js
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

const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const TARGET_USER = process.env.CSR_TARGET_USER || '6a11ea7daaf121809263f972'; // has searches/reports/logins
const out = { ran: true };

(async () => {
  if (!USER || !PWD) { console.log(JSON.stringify({ ran: false, note: 'no CSR creds' })); return; }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  let authQS = null;            // ?clientId=..&apiId=.. captured from any CSR request
  const trackingResponses = []; // raw trackings /database/search payloads
  page.on('request', (r) => { try { const s = new URL(r.url()).search; if (/clientId=/.test(s)) authQS = s; } catch {} });
  page.on('response', async (resp) => {
    if (!/\/database\/search/.test(resp.url())) return;
    try {
      const req = resp.request();
      const body = JSON.parse(req.postData() || '{}');
      if (body.collectionName === 'trackings') {
        const json = await resp.json();
        const docs = json?.docs || json?.data || [];
        trackingResponses.push({ sentUpdaterId: body.query?.updaterId, type: body.query?.['data.type'], count: docs.length,
          updaterIds: [...new Set(docs.map(d => d.updaterId))] });
      }
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

  // OPEN USER DETAIL → triggers tracking searches; click through the data tabs
  await page.goto(`${BASE}/csr/users/${TARGET_USER}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  for (const tab of ['Searches', 'Reports', 'Logins']) {
    await page.getByText(new RegExp(`^\\s*${tab}\\b`, 'i')).first().click().catch(() => {});
    await page.waitForTimeout(2500);
  }

  // ── Q1: is tracking.findUser updaterId honored server-side? ──
  // server-side honored  ⇢ every returned doc.updaterId === TARGET_USER (or [] )
  // NOT honored          ⇢ response contains other users' updaterIds
  out.trackingProbes = trackingResponses;
  const scoped = trackingResponses.filter(r => r.sentUpdaterId);
  out.updaterIdServerSideHonored = scoped.length > 0 &&
    scoped.every(r => r.updaterIds.length === 0 || r.updaterIds.every(u => u === TARGET_USER));

  // ── Q2: does user.find({ orderId }) resolve to the owning user? ──
  if (authQS) {
    try {
      // get an orderId for this user
      const ordResp = await ctx.request.post(`${BASE}/api/commerceMgmt/userOrders${authQS}`, {
        data: { userId: TARGET_USER }, timeout: 30000 });
      let orderId = null;
      try { const oj = await ordResp.json(); orderId = (oj.orders || [])[0]?._id || (oj.orders || [])[0]?.id || null; } catch {}
      out.sampleOrderId = orderId;
      if (orderId) {
        const r = await ctx.request.post(`${BASE}/api/database/search${authQS}`, {
          data: { brandId: 'idlookup', collectionName: 'users', query: { orderId } }, timeout: 30000 });
        const j = await r.json();
        const docs = j?.docs || j?.data || [];
        out.userFindByOrderId = { status: r.status(), count: docs.length,
          returnedUserIds: [...new Set(docs.map(d => d._id || d.uniqueId))].slice(0, 5) };
        out.orderIdServerSideHonored = docs.length > 0 && docs.some(d => (d._id || d.uniqueId) === TARGET_USER);
      } else out.userFindByOrderId = 'no orderId found for user';
    } catch (e) { out.userFindByOrderId = { error: e.message }; }
  } else out.note = 'no authQS captured — could not replay user.find';

  await browser.close();
  console.log('\n===== BC CSR PARAM VERIFICATION =====');
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
