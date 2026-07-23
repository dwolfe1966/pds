/* READ-ONLY live pull of the 72 users in docs/bugs/csr-admin-user-billing-state-7-23.csv
 * to compare OUR classifier (src/pages/admin/billingClassification.js) against BC.admin's
 * billing status with the SAME underlying order data.
 *
 * Fetches, per payerId (mirrors what our admin app feeds classifyBilling):
 *   - api.user.findOrders({ userId })        → orders (the exact envelope adminListPurchases returns)
 *   - api.user.findOrderHistories({ orderId })→ transitions (to test whether attaching histories changes it)
 *   - api.user.find / getUser                → user.status (getCustomerStatus checks account 'blocked')
 * NO mutations. Dumps raw JSON to scripts/out/csr-orders-72.json (gitignored — real PII).
 *
 * Creds: env CSR_USER / CSR_PWD, else parsed from docs/BC_CREDS.local.md (gitignored).
 *   docs/BC_CREDS.local.md format (any of):  CSR_USER: foo@bar   /   Email: foo@bar   /   - **Email**: `foo`
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSV = path.join(ROOT, 'docs/bugs/csr-admin-user-billing-state-7-23.csv');
const CREDS_FILE = path.join(ROOT, 'docs/BC_CREDS.local.md');
const OUT = path.join(ROOT, 'scripts/out/csr-orders-72.json');
const BASE = process.env.BC_BASE || 'https://admin.www.bytecrtrs.com';

const RTF_CREDS = path.join(ROOT, 'docs/admin/BC-ADMIN-CREDENTIALS.rtf');

function loadCreds() {
  let user = process.env.CSR_USER, pwd = process.env.CSR_PWD;
  const grabLabeled = (t) => {
    const g = (labels) => {
      for (const l of labels) {
        const m = t.match(new RegExp(`${l}[^A-Za-z0-9]*[:=][^\\S\\r\\n]*\`?([^\`\\s]+)`, 'i'));
        if (m) return m[1];
      }
      return null;
    };
    return { u: g(['CSR_USER', 'Email', 'User', 'Username']), p: g(['CSR_PWD', 'Password', 'Pass', 'PWD']) };
  };
  if ((!user || !pwd) && fs.existsSync(CREDS_FILE)) {
    const { u, p } = grabLabeled(fs.readFileSync(CREDS_FILE, 'utf8'));
    user = user || u; pwd = pwd || p;
  }
  // RTF the owner dropped: plain email + password, possibly soft-wrapped across lines.
  if ((!user || !pwd) && fs.existsSync(RTF_CREDS)) {
    let txt = '';
    try { txt = require('child_process').execSync(`textutil -convert txt -stdout "${RTF_CREDS}"`, { encoding: 'utf8' }); }
    catch { txt = fs.readFileSync(RTF_CREDS, 'utf8').replace(/\\[a-z]+\d* ?|[{}]/g, ' '); }
    // Try labeled first, else treat blank-line-separated paragraphs (lines joined) as [user, pwd].
    const lab = grabLabeled(txt);
    if (lab.u && lab.p) { user = user || lab.u; pwd = pwd || lab.p; }
    else {
      const paras = txt.split(/\n\s*\n/).map((s) => s.replace(/\s+/g, '')).filter(Boolean);
      const emailPara = paras.find((s) => /@/.test(s));
      const pwdPara = paras.find((s) => s !== emailPara && s.length >= 6);
      user = user || emailPara; pwd = pwd || pwdPara;
    }
  }
  return { user, pwd };
}

function parseCsvRows() {
  const lines = fs.readFileSync(CSV, 'utf8').split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    if (!/^\d{4}-\d{2}-\d{2},/.test(line)) continue; // data rows only
    const c = line.split(',');
    rows.push({
      name: c[3], email: c[4], payerId: c[5],
      adminTrajectory: c[7], adminTrajectoryUpdated: c[8],
    });
  }
  return rows;
}

(async () => {
  const { user, pwd } = loadCreds();
  if (!user || !pwd) {
    console.error(`Missing creds. Put them in ${CREDS_FILE} (CSR_USER / CSR_PWD) or set env vars.`);
    process.exit(1);
  }
  const rows = parseCsvRows();
  console.error(`Loaded ${rows.length} payerIds from CSV. Base=${BASE}. Logging in as ${user.replace(/(.).*(@.*)/, '$1***$2')}…`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(user).catch(() => {});
  await page.locator('input[type="password"]').first().fill(pwd).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);

  // Load the CSR IIFE wrapper into the page.
  await page.evaluate(async () => {
    for (const src of ['/libs/csr-wrapper/index.iife.js', '/libs/api-wrapper/index.iife.js']) {
      if ((src.includes('csr') && window.CsrWrapper) || (!src.includes('csr') && window.ApiWrapper)) continue;
      await new Promise((r) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = r; document.head.appendChild(s); });
    }
  });
  const ready = await page.evaluate(() => {
    try { const c = window.CsrWrapper?.getInstance ? window.CsrWrapper.getInstance({ endpointUrl: '/api' }) : window.CsrWrapper; return !!c?.api?.user; }
    catch { return false; }
  });
  if (!ready) { console.error('CsrWrapper not ready after login — check creds / login flow.'); await browser.close(); process.exit(2); }
  console.error('Logged in, CsrWrapper ready. Pulling orders…');

  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rec = await page.evaluate(async (userId) => {
      const out = { userId, err: null, user: null, orders: null, historiesByOrder: {} };
      const c = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
      const getData = (x) => (x && typeof x.getData === 'function') ? x.getData() : x;
      try {
        // user (for account status / blocked)
        try { out.user = getData(await c.api.user.find({ id: userId })) || getData(await c.api.user.getUser?.({ userId })); } catch (e) { out.userErr = e?.message; }
        // orders — the exact call adminListPurchases makes
        const ordRes = getData(await c.api.user.findOrders({ userId }));
        const orders = ordRes?.orders ?? ordRes?.data ?? (Array.isArray(ordRes) ? ordRes : []);
        out.orders = orders;
        // histories per order (separately, to test whether attaching them changes classification)
        for (const o of orders) {
          const oid = o?._id || o?.id;
          if (!oid) continue;
          try {
            const h = getData(await c.api.user.findOrderHistories({ orderId: oid }));
            out.historiesByOrder[oid] = h?.histories ?? h?.data ?? (Array.isArray(h) ? h : []);
          } catch (e) { out.historiesByOrder[oid] = { err: e?.message }; }
        }
      } catch (e) { out.err = e?.message || String(e); }
      return out;
    }, r.payerId);
    results.push({ ...r, ...rec });
    if ((i + 1) % 10 === 0) console.error(`  …${i + 1}/${rows.length}`);
    await page.waitForTimeout(250); // gentle
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
  const ok = results.filter((x) => Array.isArray(x.orders)).length;
  console.error(`Done. ${ok}/${results.length} users returned orders. Wrote ${OUT}`);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
