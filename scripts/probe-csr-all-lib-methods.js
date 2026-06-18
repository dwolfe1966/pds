/* GROUND TRUTH for every csrWrapper lib method BC may point us at. For each:
 *   - does it exist on the deployed IIFE?
 *   - which BACKEND URL does it actually hit?  (the decisive evidence)
 *   - status / error / docCount / a sample doc (keys + type)
 * Plus a DIRECT contrast (using the login clientId/apiId) for the two methods
 * BC disputes are "broken": user.findAdmin and tracking.findUser.
 *
 * Self-discovers real IDs (a user, an order, a contact message) so calls hit
 * real data, not empty sets. Creds via env. READ-ONLY.
 * Usage: CSR_USER=… CSR_PWD=… node scripts/probe-csr-all-lib-methods.js
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
  const net = [];
  let phase = 'login';
  page.on('request', (req) => {
    const u = req.url();
    if (u.includes('/auth/login') && u.includes('?') && !loginQs) loginQs = u.slice(u.indexOf('?'));
    if (/\/api\//.test(u)) {
      // strip clientId/apiId noise but keep the PATH (the decisive part)
      const path = u.replace(BASE, '').split('?')[0];
      const apiId = (u.match(/apiId=([^&]+)/) || [])[1];
      net.push({ phase, method: req.method(), path, apiId: apiId ? apiId.slice(0, 6) + '…' : null });
    }
  });

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
    await new Promise((r) => { const s = document.createElement('script'); s.src = '/libs/csr-wrapper/index.iife.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); });
  });

  // ---- 1) live surface (what exists) ----
  phase = 'surface';
  const surface = await page.evaluate(() => {
    if (!window.CsrWrapper) return { error: 'no CsrWrapper' };
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const api = csr && csr.api; if (!api) return { error: 'no api' };
    const tree = {};
    for (const ns of Object.keys(api)) {
      const node = api[ns];
      if (node && typeof node === 'object') {
        tree[ns] = {};
        for (const k of Object.keys(node)) {
          if (typeof node[k] === 'function') tree[ns][k] = 'fn';
          else if (node[k] && typeof node[k] === 'object') { tree[ns][k] = {}; for (const m of Object.keys(node[k])) if (typeof node[k][m] === 'function') tree[ns][k][m] = 'fn'; }
        }
      } else if (typeof node === 'function') tree[ns] = 'fn';
    }
    return tree;
  });

  // ---- 2) discover real IDs ----
  phase = 'discover';
  const ids = await page.evaluate(async () => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const unwrap = (r) => (r && r.getData ? r.getData() : r);
    const out = {};
    // a user (+ email)
    try {
      const u = unwrap(await csr.api.user.find.call(csr.api.user, { brandId: 'idlookup', perPage: 20 }));
      const docs = u?.docs || [];
      out.userId = docs[0]?._id; out.email = docs[0]?.email;
      // a user that has orders (scan up to 15)
      for (const d of docs.slice(0, 15)) {
        try {
          const o = unwrap(await csr.api.user.findOrders.call(csr.api.user, { userId: d._id }));
          const ords = o?.docs || o?.orders || [];
          if (ords.length) { out.userIdWithOrders = d._id; out.orderId = ords[0]._id || ords[0].id; break; }
        } catch {}
      }
    } catch (e) { out.userErr = e.message; }
    // a contact message (inbox)
    try {
      const c = unwrap(await csr.api.message.contact.find.call(csr.api.message.contact, {}));
      const docs = c?.docs || [];
      out.contactMessageId = docs[0]?._id; out.contactHash = docs[0]?.hash;
      out.contactTargetUserId = docs[0]?.content?.targetUserId;
      out.contactEmail = docs[0]?.content?.input?.email || docs[0]?.content?.email;
    } catch (e) { out.contactErr = e.message; }
    return out;
  });

  // ---- 3) call each lib method, capture url+status+count+sample ----
  const call = async (label, fnPath, args) => {
    phase = label;
    const res = await page.evaluate(async ({ fnPath, args }) => {
      try {
        const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
        const parts = fnPath.split('.'); let ctx = csr.api, fn = csr.api;
        for (const p of parts) { ctx = fn; fn = fn?.[p]; }
        if (typeof fn !== 'function') return { exists: false, siblings: Object.keys(ctx || {}) };
        const r = await fn.call(ctx, args);
        const err = r?.getError ? r.getError() : null;
        const data = r?.getData ? r.getData() : r;
        const docs = data?.docs || data?.orders || data?.payments || data?.orderHistories || data?.data || (Array.isArray(data) ? data : null);
        return {
          exists: true,
          errStatus: err?.response?.status ?? null,
          errMsg: err?.response?.data?.message || err?.message || null,
          topKeys: data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data).slice(0, 8) : (Array.isArray(data) ? `array(${data.length})` : typeof data),
          docCount: Array.isArray(docs) ? docs.length : null,
          firstDoc: Array.isArray(docs) && docs[0] ? { _id: docs[0]._id || docs[0].id, type: docs[0].type, keys: Object.keys(docs[0]).slice(0, 14) } : null,
        };
      } catch (e) { return { exists: true, thrown: e.message }; }
    }, { fnPath, args });
    return { args, ...res };
  };

  const R = {};
  // item 2.2 pair
  R['user.findUserContacts'] = await call('user.findUserContacts', 'user.findUserContacts', { userId: ids.contactTargetUserId || ids.userId });
  R['user.findUserAdminNotes'] = await call('user.findUserAdminNotes', 'user.findUserAdminNotes', { userId: ids.userId });
  // core reads we already migrated
  R['user.find'] = await call('user.find', 'user.find', { brandId: 'idlookup', perPage: 5 });
  R['user.getUserDetail'] = await call('user.getUserDetail', 'user.getUserDetail', { userId: ids.userId });
  R['user.findOrders'] = await call('user.findOrders', 'user.findOrders', { userId: ids.userIdWithOrders || ids.userId });
  R['user.getOrder'] = await call('user.getOrder', 'user.getOrder', { userId: ids.userIdWithOrders, orderId: ids.orderId });
  R['user.findOrderPayments'] = await call('user.findOrderPayments', 'user.findOrderPayments', { orderId: ids.orderId });
  R['user.findOrderHistories'] = await call('user.findOrderHistories', 'user.findOrderHistories', { orderId: ids.orderId });
  R['message.contact.find'] = await call('message.contact.find', 'message.contact.find', {});
  R['message.contact.histories'] = await call('message.contact.histories', 'message.contact.histories', { contactMessageId: ids.contactMessageId, hash: ids.contactHash });
  R['message.contact.replyLinkUrl'] = await call('message.contact.replyLinkUrl', 'message.contact.replyLinkUrl', { contactMessageId: ids.contactMessageId });
  // collection-gated reads (Data Removal / Unsubscribe)
  R['optOut.find'] = await call('optOut.find', 'optOut.find', { brandId: 'idlookup', perPage: 5 });
  R['managedContact.find'] = await call('managedContact.find', 'managedContact.find', { perPage: 5 });
  // the two BC disputes ("broken")
  R['user.findAdmin'] = await call('user.findAdmin', 'user.findAdmin', { brandId: 'idlookup', perPage: 10 });
  R['tracking.findUser'] = await call('tracking.findUser', 'tracking.findUser', { type: 'USER:login', updaterId: ids.userId, perPage: 100 });
  // List B "must add" — confirm ABSENT live
  R['billing.sale (absent?)'] = await call('billing.sale', 'billing.sale', {});
  R['offer.findByShmName (absent?)'] = await call('offer.findByShmName', 'offer.findByShmName', { shmName: 'x' });
  R['contact.find (absent?)'] = await call('contact.find', 'contact.find', {});

  // ---- 4) DIRECT contrast for the two disputes (authenticated with login qs) ----
  phase = 'direct-contrast';
  const direct = await page.evaluate(async ({ qs, userId }) => {
    const post = async (body) => {
      try {
        const res = await fetch(`/api/database/search${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await res.json().catch(() => null);
        return { status: res.status, docCount: Array.isArray(j?.docs) ? j.docs.length : null, msg: j?.message || null };
      } catch (e) { return { thrown: e.message }; }
    };
    return {
      findAdmin_direct: await post({ brandId: 'idlookup', collectionName: 'users', isAdmin: true, perPage: 10 }),
      tracking_direct: await post({ collectionName: 'trackings', query: { 'data.type': 'USER:login' }, updaterId: userId, perPage: 100 }),
    };
  }, { qs: loginQs, userId: ids.userId });

  console.log(JSON.stringify({ surface, ids, libMethods: R, directContrast: direct, urlsByPhase: net.filter(n => !['login', 'surface'].includes(n.phase)) }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
