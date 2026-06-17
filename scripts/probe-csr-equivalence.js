/* RESULT-EQUIVALENCE gate (not shape): for each List-A method, call lib vs
 * direct with IDENTICAL args/perPage and assert same _id set + same count.
 * Includes a FILTERED query for the find-methods (the regression-prone path).
 * A method only qualifies for List A if equivalence is GREEN here.
 * Creds via env. READ-ONLY.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);
  let qs = '';
  page.on('response', (res) => {
    const u = res.url();
    if (/auth\/login/i.test(u) && res.request().method() === 'POST' && u.includes('?')) qs = u.slice(u.indexOf('?'));
  });
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);

  const out = await page.evaluate(async (qs) => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const ids = (v) => {
      const arr = Array.isArray(v) ? v : (v && (v.docs || v.orders || v.payments || v.orderHistories || v.data)) || [];
      return arr.map(d => d && (d._id || d.id)).filter(Boolean);
    };
    const libCall = async (fn, args) => { try { const r = await fn(args); return ids(r?.getData ? r.getData() : r); } catch (e) { return { err: e.message }; } };
    const dirCall = async (path, body, method = 'POST') => {
      try {
        const res = await fetch(`/api${path}${path.includes('?') ? '&' + qs.slice(1) : qs}`, {
          method, credentials: 'include', headers: { 'Content-Type': 'application/json' },
          ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
        const j = await res.json().catch(() => null); return ids(j);
      } catch (e) { return { err: e.message }; }
    };
    const cmp = (a, b) => ({ libCount: Array.isArray(a) ? a.length : a, dirCount: Array.isArray(b) ? b.length : b,
      sameSet: Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every(x => b.includes(x)),
      libIds: Array.isArray(a) ? a.slice(0, 3) : a, dirIds: Array.isArray(b) ? b.slice(0, 3) : b });

    const r = {};
    // discover ids
    const ulist = await fetch(`/api/database/search${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: 'idlookup', collectionName: 'users', query: {}, perPage: 10 }) }).then(x => x.json()).catch(() => null);
    const u0 = ulist && (ulist.docs || [])[0]; const userId = u0 && u0._id; const email = u0 && u0.email;

    // ---- Tier 3: user.find unfiltered + FILTERED ----
    r.user_find_unfiltered = cmp(
      await libCall(csr.api.user.find.bind(csr.api.user), { brandId: 'idlookup', perPage: 10 }),
      await dirCall('/database/search', { brandId: 'idlookup', collectionName: 'users', query: {}, perPage: 10 }));
    if (email) r.user_find_byEmail = cmp(
      await libCall(csr.api.user.find.bind(csr.api.user), { brandId: 'idlookup', email, perPage: 10 }),
      await dirCall('/database/search', { brandId: 'idlookup', collectionName: 'users', query: { email }, perPage: 10 }));

    // ---- findAdmin ----
    r.user_findAdmin = cmp(
      await libCall(csr.api.user.findAdmin.bind(csr.api.user), { brandId: 'idlookup', perPage: 10 }),
      await dirCall('/database/search', { brandId: 'idlookup', collectionName: 'users', isAdmin: true, perPage: 10 }));

    // ---- tracking: scope by updaterId + perPage:100 ----
    if (userId) r.tracking_scoped = cmp(
      await libCall(csr.api.tracking.findUser.bind(csr.api.tracking), { type: 'USER:login', updaterId: userId, perPage: 100 }),
      await dirCall('/database/search', { collectionName: 'trackings', query: { type: 'USER:login' }, updaterId: userId, perPage: 100 }));

    // ---- Tier 1/2: orders by id ----
    if (userId) {
      const ores = await fetch(`/api/commerceMgmt/userOrders${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }).then(x => x.json()).catch(() => null);
      const orderId = ores && (ores.orders || [])[0] && (ores.orders[0]._id);
      r.user_findOrders = cmp(
        await libCall(csr.api.user.findOrders.bind(csr.api.user), { userId }),
        await dirCall('/commerceMgmt/userOrders', { userId }));
      if (orderId) {
        r.user_findOrderPayments = cmp(
          await libCall(csr.api.user.findOrderPayments.bind(csr.api.user), { orderId }),
          await dirCall('/commerceMgmt/orderPayments', { orderId }));
        r.user_findOrderHistories = cmp(
          await libCall(csr.api.user.findOrderHistories.bind(csr.api.user), { orderId }),
          await dirCall('/commerceMgmt/orderHistories', { orderId }));
      }
    }

    // ---- contact inbox + paging ----
    r.contact_find = cmp(
      await libCall(csr.api.message.contact.find.bind(csr.api.message.contact), {}),
      await dirCall('/contactMessage/admin/find', null, 'GET'));
    return r;
  }, qs);

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
