/* Self-review (before sending to BC): can EXISTING methods satisfy 2.6/3.1/3.2?
 *  2.6 offer.findByShmName  — try consumer ApiWrapper.offer.findByShmName (admin ctx) + csrWrapper.
 *  3.1 user.findAdmin (0)   — try user.find with isAdmin variations to get the 10 staff.
 *  3.2 tracking.findUser(0) — try param variations to get the target user's events (direct=100).
 * Read-only (all finders/getters). Login-confirmed. Creds via env.
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
  let loginQs = '';
  page.on('request', (req) => { const u = req.url(); if (u.includes('/auth/login') && u.includes('?') && !loginQs) loginQs = u.slice(u.indexOf('?')); });

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
  // confirm login
  let authed = false;
  for (let i = 0; i < 6; i++) {
    const ok = await page.evaluate(async () => { try { const c = window.CsrWrapper.getInstance({ endpointUrl: '/api' }); const r = await c.api.user.find.call(c.api.user, { brandId: 'idlookup', perPage: 3 }); const d = r?.getData ? r.getData() : r; return Array.isArray(d?.docs) && d.docs.length > 0; } catch { return false; } });
    if (ok) { authed = true; break; } await page.waitForTimeout(2000);
  }
  if (!authed) { console.log(JSON.stringify({ FATAL: 'login not confirmed' })); await browser.close(); return; }

  const out = await page.evaluate(async ({ qs, userId }) => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const api = window.ApiWrapper?.getInstance ? window.ApiWrapper.getInstance({ endpointUrl: '/api' }) : window.ApiWrapper;
    const cnt = (r) => { const d = r?.getData ? r.getData() : r; const docs = d?.docs || d?.commerceProducts || d?.data || (Array.isArray(d) ? d : null); return { docCount: Array.isArray(docs) ? docs.length : null, keys: d && typeof d === 'object' && !Array.isArray(d) ? Object.keys(d).slice(0, 8) : typeof d }; };
    const errOf = (r) => { const e = r?.getError ? r.getError() : null; return e?.response?.data?.message || e?.message || null; };
    const lib = async (fn, ctx, args) => { try { const r = await fn.call(ctx, args); return { ...cnt(r), err: errOf(r) }; } catch (e) { return { thrown: e.message }; } };
    const dir = async (body) => { try { const res = await fetch(`/api/database/search${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await res.json().catch(() => null); return { status: res.status, docCount: Array.isArray(j?.docs) ? j.docs.length : null, msg: j?.message || null }; } catch (e) { return { thrown: e.message }; } };

    const R = {};

    // ---- 2.6 offer.findByShmName ----
    R['2.6_offer'] = {};
    R['2.6_offer'].csrWrapper_has_offer = !!csr?.api?.offer;
    R['2.6_offer'].ApiWrapper_has_offer = !!api?.api?.offer;
    if (api?.api?.offer?.findByShmName) {
      try { const r = await api.api.offer.findByShmName.call(api.api.offer, { shmName: 'comp.offer.signup.main' });
        const d = r?.getData ? r.getData() : r; const e = r?.getError ? r.getError() : null;
        R['2.6_offer'].ApiWrapper_call = { err: e?.response?.data?.message || e?.message || null, keys: d && typeof d === 'object' ? Object.keys(d).slice(0, 10) : typeof d,
          priceInfo: d?.transient?.priceInfo || d?.priceInfo || (d?.commerceProducts ? 'commerceProducts[' + d.commerceProducts.length + ']' : null) };
      } catch (e) { R['2.6_offer'].ApiWrapper_call = { thrown: e.message }; }
    }

    // ---- 3.1 user.findAdmin: try user.find with isAdmin ----
    R['3.1_findAdmin'] = {
      direct_isAdmin: await dir({ brandId: 'idlookup', collectionName: 'users', isAdmin: true, perPage: 10 }),
      lib_findAdmin: await lib(csr.api.user.findAdmin, csr.api.user, { brandId: 'idlookup', perPage: 10 }),
      lib_find_isAdmin_top: await lib(csr.api.user.find, csr.api.user, { brandId: 'idlookup', isAdmin: true, perPage: 10 }),
      lib_find_isAdmin_query: await lib(csr.api.user.find, csr.api.user, { brandId: 'idlookup', query: { isAdmin: true }, perPage: 10 }),
      lib_findAdmin_isAdmin: await lib(csr.api.user.findAdmin, csr.api.user, { brandId: 'idlookup', isAdmin: true, perPage: 10 }),
    };

    // ---- 3.2 tracking.findUser: param variations ----
    const T = 'USER:login';
    R['3.2_tracking'] = {
      direct: await dir({ collectionName: 'trackings', query: { 'data.type': T }, updaterId: userId, perPage: 100 }),
      lib_updaterId_type: await lib(csr.api.tracking.findUser, csr.api.tracking, { type: T, updaterId: userId, perPage: 100 }),
      lib_targetUserId: await lib(csr.api.tracking.findUser, csr.api.tracking, { type: T, targetUserId: userId, perPage: 100 }),
      lib_userId: await lib(csr.api.tracking.findUser, csr.api.tracking, { type: T, userId: userId, perPage: 100 }),
      lib_query: await lib(csr.api.tracking.findUser, csr.api.tracking, { query: { 'data.type': T }, updaterId: userId, perPage: 100 }),
      lib_dataType: await lib(csr.api.tracking.findUser, csr.api.tracking, { 'data.type': T, updaterId: userId, perPage: 100 }),
      lib_noType_updaterId: await lib(csr.api.tracking.findUser, csr.api.tracking, { updaterId: userId, perPage: 100 }),
    };
    return R;
  }, { qs: loginQs, userId: USER_ID });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
