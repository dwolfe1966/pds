/* BC item 2.2 disambiguation: does csrWrapper.api.user.findUserContacts /
 * findUserAdminNotes return the `userContact` COLLECTION, or something else?
 *
 * BC told us to use those two methods instead of adding a userContact finder.
 * This calls BOTH live on an authenticated csrManager session and captures the
 * exact BACKEND URL each one hits (the smoking gun) + a doc sample, then runs the
 * direct /database/search{collectionName:userContact} call for contrast.
 *
 * Creds via env (CSR_USER / CSR_PWD), never committed. READ-ONLY.
 * Usage:  CSR_USER=… CSR_PWD=… node scripts/probe-csr-usercontact-vs-suggested.js [userId]
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const USER_ID = process.argv[2] || '6a30a88dce24e4018b18e016'; // real dev test record

(async () => {
  if (!USER || !PWD) { console.error('Set CSR_USER and CSR_PWD env vars'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);

  // Capture every backend call so we can see which URL each IIFE method hits.
  const net = [];
  page.on('request', (req) => {
    const u = req.url();
    if (/\/api\//.test(u) && /(contactMessage|findNotes|database\/search|userContact)/i.test(u)) {
      net.push({ phase: globalPhase, method: req.method(), url: u.replace(BASE, '') });
    }
  });
  let globalPhase = 'login';

  // LOGIN
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);

  await page.evaluate(async () => {
    if (window.CsrWrapper) return;
    await new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = '/libs/csr-wrapper/index.iife.js';
      s.onload = resolve; s.onerror = resolve;
      document.head.appendChild(s);
    });
  });

  const callMethod = async (path, args) => page.evaluate(async ({ path, args }) => {
    try {
      if (!window.CsrWrapper) return { error: 'no CsrWrapper' };
      const csr = typeof window.CsrWrapper.getInstance === 'function'
        ? window.CsrWrapper.getInstance({ endpointUrl: '/api' }) : window.CsrWrapper;
      const parts = path.split('.'); let ctx = csr.api; let fn = ctx;
      for (const p of parts) { ctx = fn; fn = fn?.[p]; }
      if (typeof fn !== 'function') return { error: `${path} not a function`, available: Object.keys(ctx || {}) };
      const res = await fn.call(ctx, args);
      const err = res?.getError ? res.getError() : null;
      const data = res?.getData ? res.getData() : res;
      const docs = data?.docs || data?.data || (Array.isArray(data) ? data : null);
      return {
        errStatus: err?.response?.status ?? null,
        errMsg: err?.response?.data?.message || err?.message || null,
        topKeys: data && typeof data === 'object' ? Object.keys(data).slice(0, 8) : null,
        docCount: Array.isArray(docs) ? docs.length : null,
        firstDoc: Array.isArray(docs) && docs[0] ? {
          _id: docs[0]._id, type: docs[0].type,
          keys: Object.keys(docs[0]).slice(0, 12),
          contentKeys: docs[0].content ? Object.keys(docs[0].content).slice(0, 10) : null,
        } : null,
      };
    } catch (e) { return { thrown: e.message }; }
  }, { path, args });

  globalPhase = 'findUserContacts';
  const findUserContacts = await callMethod('user.findUserContacts', { userId: USER_ID });

  globalPhase = 'findUserAdminNotes';
  const findUserAdminNotes = await callMethod('user.findUserAdminNotes', { userId: USER_ID });

  // Direct userContact collection (what our ask wraps) — expected 403 for csrManager today.
  globalPhase = 'directUserContact';
  const directUserContact = await page.evaluate(async ({ userId }) => {
    try {
      const res = await fetch('/api/database/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ collectionName: 'userContact', targetUserId: userId, perPage: 5 }),
      });
      let body; try { body = await res.json(); } catch { body = await res.text(); }
      return { status: res.status, sample: (typeof body === 'string' ? body : JSON.stringify(body)).slice(0, 240) };
    } catch (e) { return { thrown: e.message }; }
  }, { userId: USER_ID });

  console.log(JSON.stringify({
    userId: USER_ID,
    findUserContacts,        // BC says this covers us — does it return userContact docs?
    findUserAdminNotes,      // BC says this covers us — does it return userContact docs?
    directUserContact,       // our ask: the userContact collection itself
    backendUrlsHit: net,     // SMOKING GUN: which endpoint did each method actually call?
  }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
