/* For items 2.2 + 2.3: prove the DIRECT call we use today returns userContact-
 * collection records, alongside the lib method that does not. Authenticated with
 * the login clientId/apiId (same way our app's _csrPost reaches /database/search).
 *
 *  2.3 all-users:  POST /database/search { collectionName:'userContact', perPage }
 *  2.2 per-user:   POST /database/search { collectionName:'userContact', targetUserId }
 * Picks a real targetUserId from the all-users result, then re-runs the LIB
 * findUserContacts on that same id for the 0-vs-N contrast.
 *
 * Login-confirmed before trusting results. Creds via env. READ-ONLY.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;

(async () => {
  if (!USER || !PWD) { console.error('Set CSR_USER and CSR_PWD'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30000);
  let loginQs = '';
  page.on('request', (req) => { const u = req.url(); if (u.includes('/auth/login') && u.includes('?') && !loginQs) loginQs = u.slice(u.indexOf('?')); });

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => { if (window.CsrWrapper) return; await new Promise((r) => { const s = document.createElement('script'); s.src = '/libs/csr-wrapper/index.iife.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); }); });

  // confirm login
  let authed = false;
  for (let i = 0; i < 6; i++) {
    const ok = await page.evaluate(async () => { try { const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' }); const r = await csr.api.user.find.call(csr.api.user, { brandId: 'idlookup', perPage: 3 }); const d = r?.getData ? r.getData() : r; return Array.isArray(d?.docs) && d.docs.length > 0; } catch { return false; } });
    if (ok) { authed = true; break; } await page.waitForTimeout(2000);
  }
  if (!authed) { console.log(JSON.stringify({ FATAL: 'login not confirmed' })); await browser.close(); return; }

  const result = await page.evaluate(async ({ qs }) => {
    const post = async (body) => {
      try {
        const res = await fetch(`/api/database/search${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await res.json().catch(() => null);
        const docs = Array.isArray(j?.docs) ? j.docs : null;
        return { status: res.status, msg: j?.message || null, docCount: docs ? docs.length : null,
          firstDoc: docs && docs[0] ? { _id: docs[0]._id, type: docs[0].type, targetUserId: docs[0]?.content?.targetUserId, keys: Object.keys(docs[0]).slice(0, 12), contentKeys: docs[0].content ? Object.keys(docs[0].content).slice(0, 10) : null } : null,
          types: docs ? [...new Set(docs.map(d => d.type))] : null };
      } catch (e) { return { thrown: e.message }; }
    };
    const out = {};
    // 2.3 — all-users userContact
    out.direct_allUsers = await post({ collectionName: 'userContact', perPage: 20 });
    out.direct_allUsers_brandId = await post({ brandId: 'idlookup', collectionName: 'userContact', perPage: 20 });
    // pick a real targetUserId from whichever returned docs
    const pick = out.direct_allUsers.firstDoc?.targetUserId || out.direct_allUsers_brandId.firstDoc?.targetUserId || null;
    out.pickedTargetUserId = pick;
    // 2.2 — per-user userContact (direct)
    if (pick) out.direct_perUser = await post({ collectionName: 'userContact', targetUserId: pick });
    // lib contrast on the SAME id
    if (pick) {
      try {
        const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
        const r = await csr.api.user.findUserContacts.call(csr.api.user, { userId: pick });
        const d = r?.getData ? r.getData() : r; const err = r?.getError ? r.getError() : null;
        out.lib_findUserContacts_sameId = { errMsg: err?.message || null, docCount: Array.isArray(d?.docs) ? d.docs.length : null };
      } catch (e) { out.lib_findUserContacts_sameId = { thrown: e.message }; }
    }
    return out;
  }, { qs: loginQs });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
