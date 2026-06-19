/* (a) READ-ONLY confidence check on the CSR mutation set. For each mutation:
 *   - does the lib method EXIST on the deployed IIFE?
 *   - REACHABILITY: call with EMPTY/invalid args (no valid record id → no write
 *     possible) and read the status: 400/406/422 = reachable+authorized (would work
 *     with a valid body), 403 = forbidden (broken for CSR role), 404/405 = absent.
 * PURE-CREATE endpoints are existence-checked ONLY (never called — could create junk).
 * NO real ids are ever passed. Login-confirmed. Creds via env.
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
  await page.evaluate(async () => { for (const s of ['/libs/api-wrapper/index.iife.js','/libs/csr-wrapper/index.iife.js']) { if ((s.includes('csr')&&window.CsrWrapper)||(!s.includes('csr')&&window.ApiWrapper)) continue; await new Promise(r=>{const e=document.createElement('script');e.src=s;e.onload=r;e.onerror=r;document.head.appendChild(e);}); } });
  let authed = false;
  for (let i = 0; i < 6; i++) { const ok = await page.evaluate(async () => { try { const c = window.CsrWrapper.getInstance({ endpointUrl: '/api' }); const r = await c.api.user.find.call(c.api.user, { brandId: 'idlookup', perPage: 3 }); const d = r?.getData ? r.getData() : r; return Array.isArray(d?.docs) && d.docs.length > 0; } catch { return false; } }); if (ok) { authed = true; break; } await page.waitForTimeout(2000); }
  if (!authed) { console.log(JSON.stringify({ FATAL: 'login not confirmed' })); await browser.close(); return; }

  const out = await page.evaluate(async () => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const api = window.ApiWrapper?.getInstance ? window.ApiWrapper.getInstance({ endpointUrl: '/api' }) : window.ApiWrapper;
    const resolve = (root, path) => { const p = path.split('.'); let ctx = root, fn = root; for (const k of p) { ctx = fn; fn = fn?.[k]; } return { ctx, fn }; };
    const exists = (root, path) => typeof resolve(root, path).fn === 'function';
    // REACHABILITY: call with empty args (no valid id → no write). Classify by status.
    const reach = async (root, path, args = {}) => {
      const { ctx, fn } = resolve(root, path);
      if (typeof fn !== 'function') return { exists: false };
      try {
        const r = await fn.call(ctx, args);
        const err = r?.getError ? r.getError() : null;
        const status = err?.response?.status ?? null;
        const msg = err?.response?.data?.message || err?.message || null;
        return { exists: true, status, msg: Array.isArray(msg) ? msg.join('; ') : msg, ok: !err };
      } catch (e) { return { exists: true, thrown: e.message }; }
    };

    const R = { reachability: {}, existenceOnly: {} };
    // ID-gated mutations — empty args, no valid record → safe to call
    R.reachability['user.cancelUncancelOrder']   = await reach(csr.api, 'user.cancelUncancelOrder', {});
    R.reachability['user.refundVoidOrder']       = await reach(csr.api, 'user.refundVoidOrder', {});
    R.reachability['user.updateSchedule']        = await reach(csr.api, 'user.updateSchedule', {});
    R.reachability['user.update']                = await reach(csr.api, 'user.update', {});  // suspend/profile edit
    R.reachability['message.contact.setTargetUser'] = await reach(csr.api, 'message.contact.setTargetUser', {});
    R.reachability['message.contact.setTags']    = await reach(csr.api, 'message.contact.setTags', {});
    R.reachability['message.contact.setActor']   = await reach(csr.api, 'message.contact.setActor', {});
    R.reachability['message.note.updateAdminNote'] = await reach(csr.api, 'message.note.updateAdminNote', {});
    R.reachability['managedContact.unsubscribe'] = await reach(csr.api, 'managedContact.unsubscribe', {});
    // PURE CREATE / charge — existence only (NOT called)
    for (const p of ['message.contact.create','message.contact.createCsrReply','message.note.createContactAdminNote','message.note.createUserAdminNote']) {
      R.existenceOnly['csr:' + p] = exists(csr.api, p);
    }
    R.existenceOnly['csr:contact.changeContactToUserContact'] = exists(csr.api, 'contact.changeContactToUserContact');
    R.existenceOnly['ApiWrapper:billing.sale'] = exists(api?.api, 'billing.sale');
    R.existenceOnly['ApiWrapper:billing.tokenSale'] = exists(api?.api, 'billing.tokenSale');
    R.existenceOnly['csr:billing'] = !!csr?.api?.billing;
    return R;
  });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
