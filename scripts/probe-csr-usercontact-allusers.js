/* Item 2.3 (ALL userContact records / unified inbox): BC says use
 * user.findUserContacts + user.findUserAdminNotes. Both are PER-USER. This calls
 * each with NO userId (the all-users case 2.3 needs) and captures the backend URL +
 * status + error, then with a real userId for contrast. Confirms neither can
 * enumerate all userContact-collection records.
 *
 * Includes a login-confirmation wait (user.find must return docs) to avoid the
 * session-not-ready false-403 glitch. Creds via env. READ-ONLY.
 * Usage: CSR_USER=… CSR_PWD=… node scripts/probe-csr-usercontact-allusers.js [userId]
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const USER_ID = process.argv[2] || '6a30a88dce24e4018b18e016';

(async () => {
  if (!USER || !PWD) { console.error('Set CSR_USER and CSR_PWD'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30000);

  const net = [];
  let phase = 'login';
  page.on('request', (req) => {
    const u = req.url();
    if (/\/api\//.test(u)) net.push({ phase, method: req.method(), path: u.replace(BASE, '').split('?')[0] });
  });

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    if (window.CsrWrapper) return;
    await new Promise((r) => { const s = document.createElement('script'); s.src = '/libs/csr-wrapper/index.iife.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); });
  });

  // LOGIN CONFIRMATION: user.find must return docs before we trust anything.
  phase = 'confirm-login';
  let authed = false;
  for (let i = 0; i < 6; i++) {
    const ok = await page.evaluate(async () => {
      try {
        const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
        const r = await csr.api.user.find.call(csr.api.user, { brandId: 'idlookup', perPage: 3 });
        const d = r?.getData ? r.getData() : r;
        return Array.isArray(d?.docs) && d.docs.length > 0;
      } catch { return false; }
    });
    if (ok) { authed = true; break; }
    await page.waitForTimeout(2000);
  }
  if (!authed) { console.log(JSON.stringify({ FATAL: 'login not confirmed (user.find empty) — session not ready', net }, null, 2)); await browser.close(); return; }

  const call = async (label, fnPath, args) => {
    phase = label;
    return await page.evaluate(async ({ fnPath, args, hasArgs }) => {
      try {
        const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
        const parts = fnPath.split('.'); let ctx = csr.api, fn = csr.api;
        for (const p of parts) { ctx = fn; fn = fn?.[p]; }
        if (typeof fn !== 'function') return { exists: false };
        const r = hasArgs ? await fn.call(ctx, args) : await fn.call(ctx);
        const err = r?.getError ? r.getError() : null;
        const data = r?.getData ? r.getData() : r;
        const docs = data?.docs || data?.data || (Array.isArray(data) ? data : null);
        return {
          errStatus: err?.response?.status ?? null,
          errMsg: err?.response?.data?.message || err?.message || null,
          docCount: Array.isArray(docs) ? docs.length : null,
          firstType: Array.isArray(docs) && docs[0] ? docs[0].type : null,
        };
      } catch (e) { return { thrown: e.message }; }
    }, { fnPath, args, hasArgs: arguments.length > 2 });
  };

  const out = {};
  // 2.3 needs ALL-USERS — call with NO userId:
  out['findUserContacts_NOuserId'] = await call('findUserContacts_NOuserId', 'user.findUserContacts', {});
  out['findUserContacts_undefinedArgs'] = await call('findUserContacts_undefinedArgs', 'user.findUserContacts');
  out['findUserAdminNotes_NOuserId'] = await call('findUserAdminNotes_NOuserId', 'user.findUserAdminNotes', {});
  // contrast: WITH a real userId (per-user case)
  out['findUserContacts_withUserId'] = await call('findUserContacts_withUserId', 'user.findUserContacts', { userId: USER_ID });
  out['findUserAdminNotes_withUserId'] = await call('findUserAdminNotes_withUserId', 'user.findUserAdminNotes', { userId: USER_ID });

  console.log(JSON.stringify({ results: out, urls: net.filter(n => !['login', 'confirm-login'].includes(n.phase)) }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
