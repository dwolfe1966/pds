/* 3.1 _id-equivalence (NOT count): is user.find({isAdmin:true}) returning the SAME
 * 10 as the direct isAdmin call, AND is it DIFFERENT from the unfiltered default?
 * If filtered==unfiltered, isAdmin is being ignored → 3.1 NOT solved.
 * Read-only. Login-confirmed. Creds via env.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;

(async () => {
  if (!USER || !PWD) { console.error('Set CSR_USER and CSR_PWD'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30000);
  let qs = '';
  page.on('request', (req) => { const u = req.url(); if (u.includes('/auth/login') && u.includes('?') && !qs) qs = u.slice(u.indexOf('?')); });
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => { if (window.CsrWrapper) return; await new Promise((r) => { const s = document.createElement('script'); s.src = '/libs/csr-wrapper/index.iife.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); }); });
  let authed = false;
  for (let i = 0; i < 6; i++) { const ok = await page.evaluate(async () => { try { const c = window.CsrWrapper.getInstance({ endpointUrl: '/api' }); const r = await c.api.user.find.call(c.api.user, { brandId: 'idlookup', perPage: 3 }); const d = r?.getData ? r.getData() : r; return Array.isArray(d?.docs) && d.docs.length > 0; } catch { return false; } }); if (ok) { authed = true; break; } await page.waitForTimeout(2000); }
  if (!authed) { console.log(JSON.stringify({ FATAL: 'login not confirmed' })); await browser.close(); return; }

  const out = await page.evaluate(async ({ qs }) => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const ids = (r) => { const d = r?.getData ? r.getData() : r; return (d?.docs || []).map(x => x._id); };
    const lib = async (args) => ids(await csr.api.user.find.call(csr.api.user, args));
    const dir = async (body) => { const res = await fetch(`/api/database/search${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await res.json().catch(() => null); return (j?.docs || []).map(x => x._id); };

    const directAdmin = await dir({ brandId: 'idlookup', collectionName: 'users', isAdmin: true, perPage: 10 });
    const libIsAdminTop = await lib({ brandId: 'idlookup', isAdmin: true, perPage: 10 });
    const libIsAdminQuery = await lib({ brandId: 'idlookup', query: { isAdmin: true }, perPage: 10 });
    const libUnfiltered = await lib({ brandId: 'idlookup', perPage: 10 });

    const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
    const overlap = (a, b) => a.filter(x => b.includes(x)).length;
    return {
      counts: { directAdmin: directAdmin.length, libIsAdminTop: libIsAdminTop.length, libIsAdminQuery: libIsAdminQuery.length, libUnfiltered: libUnfiltered.length },
      libTop_eq_directAdmin: sameSet(libIsAdminTop, directAdmin),
      libQuery_eq_directAdmin: sameSet(libIsAdminQuery, directAdmin),
      libTop_overlap_directAdmin: overlap(libIsAdminTop, directAdmin),
      // the KILLER check: if filtered == unfiltered default, isAdmin is IGNORED
      libTop_eq_unfiltered: sameSet(libIsAdminTop, libUnfiltered),
      directAdmin_eq_unfiltered: sameSet(directAdmin, libUnfiltered),
      sample: { directAdmin: directAdmin.slice(0, 3), libIsAdminTop: libIsAdminTop.slice(0, 3), libUnfiltered: libUnfiltered.slice(0, 3) },
    };
  }, { qs });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
