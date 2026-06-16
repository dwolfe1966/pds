/* Check the dedicated (non-/database/search) CSR endpoints that back the
 * customer-detail page, since several /database/search collections are still
 * 403. Logs in, grabs a real userId from users search, then exercises:
 *   /commerceMgmt/userOrders  (Orders tab)
 *   /user/management/detail   (open a customer)
 *   /message/admin/findNotes  (Notes read)
 *   /contactMessage/admin/find (Tickets inbox)
 * Creds via env (CSR_USER / CSR_PWD), never committed. READ-ONLY.
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
  await page.waitForTimeout(4000);

  const out = await page.evaluate(async (qs) => {
    const post = async (path, body) => {
      try {
        const res = await fetch(`/api${path}${qs}`, { method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        let j; try { j = await res.json(); } catch { j = null; }
        return { status: res.status, j };
      } catch (e) { return { thrown: e.message }; }
    };
    const get = async (path) => {
      try {
        const res = await fetch(`/api${path}${qs ? qs + '&' : '?'}`, { credentials: 'include' });
        let j; try { j = await res.json(); } catch { j = null; }
        return { status: res.status, j };
      } catch (e) { return { thrown: e.message }; }
    };
    const count = (j) => Array.isArray(j) ? j.length : (j && (j.docs || j.data || j.results || j.orders) || []).length;

    // get a real userId
    const u = await post('/database/search', { brandId: 'idlookup', collectionName: 'users', query: {}, perPage: 1 });
    const userId = u.j && (u.j.docs || u.j.data || [])[0] && (u.j.docs || u.j.data)[0]._id;

    const orders   = await post('/commerceMgmt/userOrders', { userId });
    const detail   = await post('/user/management/detail', { userId });
    const notes    = await (async () => {
      try {
        const res = await fetch(`/api/message/admin/findNotes${qs}&userId=${userId}`, { credentials: 'include' });
        let j; try { j = await res.json(); } catch { j = null; } return { status: res.status, j };
      } catch (e) { return { thrown: e.message }; }
    })();
    const tickets  = await get('/contactMessage/admin/find');

    return {
      sampledUserId: userId || null,
      ordersTab:      { status: orders.status,  rows: count(orders.j),  msg: orders.j?.message || null },
      openCustomer:   { status: detail.status,  ok: !!detail.j,         msg: detail.j?.message || null },
      notesRead:      { status: notes.status,   rows: count(notes.j),   msg: notes.j?.message || null },
      ticketsInbox:   { status: tickets.status, rows: count(tickets.j), msg: tickets.j?.message || null },
    };
  }, qs);

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
