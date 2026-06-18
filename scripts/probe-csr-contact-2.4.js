/* Item 2.4 (visitor contact messages): BC says use message.contact.find instead
 * of a `contact`-collection finder. Question = do they return the SAME data?
 * Compares, live + login-confirmed:
 *   LIB    csrWrapper.api.message.contact.find({})           → GET /contactMessage/admin/find
 *   DIRECT /database/search { collectionName:'contact' }     → the `contact` collection (our 2.4 call)
 * Reports _id sets, types, counts, status → equivalence verdict.
 * Creds via env. READ-ONLY.
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
  const urls = [];
  let phase = 'login';
  page.on('request', (req) => { const u = req.url(); if (u.includes('/auth/login') && u.includes('?') && !loginQs) loginQs = u.slice(u.indexOf('?')); if (/\/api\//.test(u)) urls.push({ phase, method: req.method(), path: u.replace(BASE, '').split('?')[0] }); });

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => { if (window.CsrWrapper) return; await new Promise((r) => { const s = document.createElement('script'); s.src = '/libs/csr-wrapper/index.iife.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); }); });

  let authed = false;
  phase = 'confirm';
  for (let i = 0; i < 6; i++) {
    const ok = await page.evaluate(async () => { try { const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' }); const r = await csr.api.user.find.call(csr.api.user, { brandId: 'idlookup', perPage: 3 }); const d = r?.getData ? r.getData() : r; return Array.isArray(d?.docs) && d.docs.length > 0; } catch { return false; } });
    if (ok) { authed = true; break; } await page.waitForTimeout(2000);
  }
  if (!authed) { console.log(JSON.stringify({ FATAL: 'login not confirmed' })); await browser.close(); return; }

  phase = 'lib';
  const lib = await page.evaluate(async () => {
    try {
      const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
      const r = await csr.api.message.contact.find.call(csr.api.message.contact, { perPage: 20 });
      const err = r?.getError ? r.getError() : null; const d = r?.getData ? r.getData() : r;
      const docs = d?.docs || [];
      return { errMsg: err?.message || null, count: docs.length, types: [...new Set(docs.map(x => x.type))], ids: docs.map(x => x._id) };
    } catch (e) { return { thrown: e.message }; }
  });

  phase = 'direct-contact';
  const direct = await page.evaluate(async ({ qs }) => {
    const post = async (body) => {
      try { const res = await fetch(`/api/database/search${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await res.json().catch(() => null); const docs = Array.isArray(j?.docs) ? j.docs : null;
        return { status: res.status, msg: j?.message || null, count: docs ? docs.length : null, types: docs ? [...new Set(docs.map(x => x.type))] : null, ids: docs ? docs.map(x => x._id) : null };
      } catch (e) { return { thrown: e.message }; }
    };
    return { noBrand: await post({ collectionName: 'contact', perPage: 20 }), withBrand: await post({ brandId: 'idlookup', collectionName: 'contact', perPage: 20 }) };
  }, { qs: loginQs });

  // equivalence verdict (lib vs whichever direct shape returned docs)
  const dir = (direct.withBrand.ids && direct.withBrand.ids.length ? direct.withBrand : direct.noBrand);
  let verdict = null;
  if (lib.ids && dir.ids) {
    const ls = new Set(lib.ids), ds = new Set(dir.ids);
    const inBoth = lib.ids.filter(x => ds.has(x)).length;
    verdict = { libCount: lib.ids.length, directCount: dir.ids.length, overlap: inBoth, sameSet: lib.ids.length === dir.ids.length && lib.ids.every(x => ds.has(x)) };
  }

  console.log(JSON.stringify({ lib_message_contact_find: lib, direct_contact_collection: direct, equivalence: verdict, urls: urls.filter(u => !['login', 'confirm'].includes(u.phase)) }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
