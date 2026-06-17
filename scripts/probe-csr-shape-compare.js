/* For each List-A method whose data currently flows, compare the LIB method's
 * normalized output (getData()) against the DIRECT endpoint body — so we know
 * whether _viaCsr can drop in cleanly or needs an envelope adapter.
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

  const result = await page.evaluate(async (qs) => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const sig = (v) => {
      if (v == null) return String(v);
      if (Array.isArray(v)) return { array: v.length, item0Keys: v[0] && typeof v[0] === 'object' ? Object.keys(v[0]).slice(0, 12) : typeof v[0] };
      if (typeof v === 'object') {
        const o = { keys: Object.keys(v).slice(0, 12) };
        for (const k of ['docs', 'data', 'orders', 'results', 'histories', 'payments']) {
          if (Array.isArray(v[k])) o[k] = { array: v[k].length, item0Keys: v[k][0] ? Object.keys(v[k][0]).slice(0, 12) : null };
        }
        return o;
      }
      return typeof v;
    };
    const lib = async (fn, args) => {
      try { const r = await fn(args); const d = r?.getData ? r.getData() : r; return sig(d); }
      catch (e) { return { error: e.message }; }
    };
    const direct = async (path, body, method = 'POST') => {
      try {
        const res = await fetch(`/api${path}${path.includes('?') ? '&' : qs}`, {
          method, credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
        });
        let j; try { j = await res.json(); } catch { j = null; }
        return { status: res.status, sig: sig(j) };
      } catch (e) { return { error: e.message }; }
    };

    const out = {};
    // users
    out.user_find = { lib: await lib(csr.api.user.find.bind(csr.api.user), { brandId: 'idlookup' }),
                      direct: await direct('/database/search', { brandId: 'idlookup', collectionName: 'users', query: {}, perPage: 5 }) };
    out.user_findAdmin = { lib: await lib(csr.api.user.findAdmin.bind(csr.api.user), { brandId: 'idlookup' }),
                           direct: await direct('/database/search', { brandId: 'idlookup', collectionName: 'users', isAdmin: true, perPage: 5 }) };
    out.tracking_findUser = { lib: await lib(csr.api.tracking.findUser.bind(csr.api.tracking), { type: 'USER:login' }),
                              direct: await direct('/database/search', { collectionName: 'trackings', query: { type: 'USER:login' }, perPage: 5 }) };

    // discover a userId + orderId from the working users + orders endpoints
    const ures = await fetch(`/api/database/search${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brandId: 'idlookup', collectionName: 'users', query: {}, perPage: 10 }) }).then(r => r.json()).catch(() => null);
    const userId = ures && (ures.docs || ures.data || []).map(d => d._id).find(Boolean);
    let orderId = null;
    if (userId) {
      const ores = await fetch(`/api/commerceMgmt/userOrders${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }).then(r => r.json()).catch(() => null);
      const olist = ores && (ores.docs || ores.orders || ores.data || (Array.isArray(ores) ? ores : []));
      orderId = olist && olist[0] && (olist[0]._id || olist[0].id);
      out._ids = { userId, orderId, ordersBodyKeys: ores ? Object.keys(ores).slice(0, 12) : null };
      out.user_findOrders = { lib: await lib(csr.api.user.findOrders.bind(csr.api.user), { userId }),
                              direct: await direct('/commerceMgmt/userOrders', { userId }) };
      if (orderId) {
        out.user_getOrder = { lib: await lib(csr.api.user.getOrder.bind(csr.api.user), { userId, orderId }),
                              direct: await direct('/commerceMgmt/getUserOrder', { userId, orderId }) };
        out.user_findOrderPayments = { lib: await lib(csr.api.user.findOrderPayments.bind(csr.api.user), { orderId }),
                                       direct: await direct('/commerceMgmt/orderPayments', { orderId }) };
        out.user_findOrderHistories = { lib: await lib(csr.api.user.findOrderHistories.bind(csr.api.user), { orderId }),
                                        direct: await direct('/commerceMgmt/orderHistories', { orderId }) };
      }
    }

    // contact messages
    out.contact_find = { lib: await lib(csr.api.message.contact.find.bind(csr.api.message.contact), {}),
                         direct: await direct('/contactMessage/admin/find', null, 'GET') };
    const cres = await fetch(`/api/contactMessage/admin/find${qs}`, { credentials: 'include' }).then(r => r.json()).catch(() => null);
    const cmId = cres && (cres.docs || cres.data || []).map(d => d._id).find(Boolean);
    if (cmId) {
      out.contact_histories = { lib: await lib(csr.api.message.contact.histories.bind(csr.api.message.contact), { contactMessageId: cmId }),
                                direct: await direct(`/contactMessage/admin/histories?contactMessageId=${cmId}`, null, 'GET') };
    }
    return out;
  }, qs);

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
