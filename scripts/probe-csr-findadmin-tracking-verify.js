/* Focused re-verification (2026-06-22) of the two probe results the all-lib-methods
 * run got WRONG by passing trap params:
 *   - findAdmin: all-lib probe sent {brandId:'idlookup'} (→0, the brandId trap).
 *     Re-test no-brand + bytecrtrs, _id/email/role-check the docs are real CSR staff,
 *     and contrast with the REAL query csrFindCsReps uses: {collectionName:'admins'}.
 *   - tracking.findUser: check whether the lib's small count is correct per-user
 *     scoping (all docs share updaterId) vs a cap.
 * Also asserts the APP's actual guard _isUsableList on each raw lib result, so
 * "migrate-safe" means the production guard passes — not just docCount>0.
 * READ-ONLY. Usage: CSR_USER=… CSR_PWD=… node scripts/probe-csr-findadmin-tracking-verify.js
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
  await page.waitForTimeout(4000);
  await page.evaluate(async () => { if (window.CsrWrapper) return; await new Promise((r) => { const s = document.createElement('script'); s.src = '/libs/csr-wrapper/index.iife.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); }); });

  const out = await page.evaluate(async ({ qs }) => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const unwrap = (r) => (r && r.getData ? r.getData() : r);
    // LOGIN-CONFIRMATION GATE: do not trust any result until user.find returns data
    // (memory: un-authed sessions return blanket 403/0 on /database/search).
    let authConfirmed = false, authUserId = null;
    for (let i = 0; i < 8; i++) {
      try { const u = unwrap(await csr.api.user.find.call(csr.api.user, { brandId: 'idlookup', perPage: 20 })); const docs = u?.docs || []; if (docs.length) { authConfirmed = true; authUserId = docs[0]?._id; break; } } catch {}
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!authConfirmed) return { ABORT: 'auth not confirmed — user.find returned no docs after retries; results would be the un-authed glitch' };
    // the app's REAL guard (copied from apiWrapperCsr._isUsableList)
    const isUsableList = (r) => {
      if (Array.isArray(r)) return true;
      if (!r || typeof r !== 'object') return false;
      return Array.isArray(r.docs) || Array.isArray(r.orders) || Array.isArray(r.payments) || Array.isArray(r.orderHistories) || Array.isArray(r.data);
    };
    const summarizeStaff = (data) => {
      const docs = data?.docs || (Array.isArray(data) ? data : []);
      return {
        usableList: isUsableList(data),
        docCount: docs.length,
        sample: docs.slice(0, 5).map(d => ({ email: d.email, roles: d.roles, brandId: d.brandId, _id: (d._id || '').slice(-6) })),
      };
    };
    const callFindAdmin = async (args) => { try { return summarizeStaff(unwrap(await csr.api.user.findAdmin.call(csr.api.user, args))); } catch (e) { return { thrown: e.message }; } };

    const res = { authConfirmed, authUserId: (authUserId || '').slice(-6) };
    res.findAdmin_noBrand   = await callFindAdmin({ perPage: 10 });
    res.findAdmin_bytecrtrs = await callFindAdmin({ brandId: 'bytecrtrs', perPage: 10 });
    res.findAdmin_idlookup  = await callFindAdmin({ brandId: 'idlookup', perPage: 10 });

    // The query csrFindCsReps ACTUALLY falls back to: direct {collectionName:'admins'}
    const post = async (body) => { try { const r = await fetch(`/api/database/search${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => null); return { status: r.status, ...summarizeStaff(j), msg: j?.message || null }; } catch (e) { return { thrown: e.message }; } };
    res.direct_admins = await post({ collectionName: 'admins', perPage: 10 });

    // tracking scoping: use the auth-confirmed user, check updaterId spread
    const trackingUserId = authUserId;
    const trk = async (args) => { try { const data = unwrap(await csr.api.tracking.findUser.call(csr.api.tracking, args)); const docs = data?.docs || (Array.isArray(data) ? data : []); const updaters = [...new Set(docs.map(d => d.updaterId))]; return { usableList: isUsableList(data), docCount: docs.length, distinctUpdaterIds: updaters.length, scopedToOne: updaters.length <= 1, target: (trackingUserId || '').slice(-6), updatersSample: updaters.slice(0, 4).map(x => (x || '').slice(-6)) }; } catch (e) { return { thrown: e.message }; } };
    res.tracking_lib = await trk({ type: 'USER:login', updaterId: trackingUserId, perPage: 100 });

    return res;
  }, { qs: loginQs });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
