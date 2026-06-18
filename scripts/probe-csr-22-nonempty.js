/* 2.2 rebuttal to "no results": find a user who HAS data, show findUserContacts
 * returns NON-EMPTY contactMessage rows (proving it reads the contactMessage
 * collection, not userContact). 6a30a88 just has no support history → 0 is expected.
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
  const urls = [];
  let phase = 'login';
  page.on('request', (req) => { const u = req.url(); if (/contactMessage|findNotes|database\/search/i.test(u)) urls.push({ phase, path: u.replace(BASE, '').split('?')[0] }); });

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

  phase = 'scan';
  const out = await page.evaluate(async () => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const unwrap = (r) => (r && r.getData ? r.getData() : r);
    // page through the inbox to find a contactMessage that carries a targetUserId (member-linked)
    let cursor = null, picked = null, scanned = 0;
    for (let p = 0; p < 10 && !picked; p++) {
      const d = unwrap(await csr.api.message.contact.find.call(csr.api.message.contact, cursor ? { lastId: cursor } : {}));
      const docs = d?.docs || []; scanned += docs.length;
      for (const x of docs) { const t = x?.content?.targetUserId; if (t) { picked = { targetUserId: t, contactMessageId: x._id, type: x.type, email: x?.content?.input?.email || x?.content?.email }; break; } }
      const next = docs.length ? docs[docs.length - 1]._id : null;
      if (d?.noMoreDocs || !next || next === cursor) break; cursor = next;
    }
    const res = { scannedInbox: scanned, picked };
    if (picked) {
      const uid = picked.targetUserId;
      const fc = unwrap(await csr.api.user.findUserContacts.call(csr.api.user, { userId: uid }));
      const fn = unwrap(await csr.api.user.findUserAdminNotes.call(csr.api.user, { userId: uid }));
      const fcDocs = fc?.docs || [];
      res.findUserContacts = { userId: uid, count: fcDocs.length, types: [...new Set(fcDocs.map(x => x.type))], sampleId: fcDocs[0]?._id };
      res.findUserAdminNotes = { userId: uid, count: (fn?.docs || []).length };
    }
    return res;
  });

  console.log(JSON.stringify({ ...out, urls: urls.filter(u => u.phase === 'scan') }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
