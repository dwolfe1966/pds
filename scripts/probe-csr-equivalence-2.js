/* Equivalence gate for the QUEUED List-A methods: getOrder, message.contact.find
 * (incl. latestReply fields + lastId paging), message.contact.histories, replyLinkUrl.
 * lib vs direct on the same args. Creds via env. READ-ONLY.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);
  let qs = '';
  page.on('response', (res) => { const u = res.url();
    if (/auth\/login/i.test(u) && res.request().method() === 'POST' && u.includes('?')) qs = u.slice(u.indexOf('?')); });
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);

  const out = await page.evaluate(async (qs) => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const data = (r) => (r && r.getData ? r.getData() : r);
    const docsOf = (v) => Array.isArray(v) ? v : (v && (v.docs || v.orders || v.data)) || [];
    const idsOf = (v) => docsOf(v).map(d => d && (d._id || d.id)).filter(Boolean);
    const keysOf = (v) => { const d = docsOf(v)[0]; return d ? Object.keys(d).sort() : null; };
    const dGet = async (p) => { try { const r = await fetch(`/api${p}${p.includes('?') ? '&' + qs.slice(1) : qs}`, { credentials: 'include' }); return await r.json().catch(() => null); } catch (e) { return { err: e.message }; } };
    const dPost = async (p, b) => { try { const r = await fetch(`/api${p}${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); return await r.json().catch(() => null); } catch (e) { return { err: e.message }; } };
    const lib = async (fn, a) => { try { return data(await fn(a)); } catch (e) { return { err: e.message }; } };
    const cmpIds = (a, b) => ({ lib: idsOf(a).slice(0, 5), dir: idsOf(b).slice(0, 5), libN: idsOf(a).length, dirN: idsOf(b).length,
      sameSet: idsOf(a).length === idsOf(b).length && idsOf(a).every(x => idsOf(b).includes(x)),
      libKeys: keysOf(a), dirKeys: keysOf(b),
      sameKeys: JSON.stringify(keysOf(a)) === JSON.stringify(keysOf(b)) });

    const r = {};
    // ---- getOrder ----
    const ulist = await dPost('/database/search', { brandId: 'idlookup', collectionName: 'users', query: {}, perPage: 10 });
    const userId = (ulist.docs || []).map(d => d._id).find(Boolean);
    const ores = userId ? await dPost('/commerceMgmt/userOrders', { userId }) : null;
    const orderId = ores && (ores.orders || [])[0] && ores.orders[0]._id;
    if (userId && orderId) {
      const libO = await lib(csr.api.user.getOrder.bind(csr.api.user), { userId, orderId });
      const dirO = await dPost('/commerceMgmt/getUserOrder', { userId, orderId });
      r.getOrder = { libOrderId: libO?.order?._id || null, dirOrderId: dirO?.order?._id || null,
        match: (libO?.order?._id || 'L') === (dirO?.order?._id || 'D'),
        libKeys: libO?.order ? Object.keys(libO.order).sort().slice(0, 14) : null };
    }

    // ---- contact.find (inbox): ids + keys + latestReply + lastId paging ----
    const libC1 = await lib(csr.api.message.contact.find.bind(csr.api.message.contact), {});
    const dirC1 = await dGet('/contactMessage/admin/find');
    r.contact_find_page1 = cmpIds(libC1, dirC1);
    r.contact_find_page1.libHasLatestReply = docsOfHas(libC1, 'latestReply');
    r.contact_find_page1.dirHasLatestReply = docsOfHas(dirC1, 'latestReply');
    function docsOfHas(v, k) { const d = (Array.isArray(v) ? v : (v && v.docs) || []); return d.some(x => x && k in x); }
    const lastId1 = idsOf(dirC1).slice(-1)[0];
    if (lastId1) {
      const libC2 = await lib(csr.api.message.contact.find.bind(csr.api.message.contact), { lastId: lastId1 });
      const dirC2 = await dGet(`/contactMessage/admin/find?lastId=${lastId1}`);
      r.contact_find_page2 = cmpIds(libC2, dirC2);
    }

    // ---- contact.histories ----
    const cmId = idsOf(dirC1)[0];
    if (cmId) {
      const libH = await lib(csr.api.message.contact.histories.bind(csr.api.message.contact), { contactMessageId: cmId });
      const dirH = await dGet(`/contactMessage/admin/histories?contactMessageId=${cmId}`);
      r.contact_histories = cmpIds(libH, dirH);
      // ---- replyLinkUrl ----
      const libR = await lib(csr.api.message.contact.replyLinkUrl.bind(csr.api.message.contact), { messageId: cmId });
      const dirR = await dGet(`/contactMessage/admin/replyUrl?messageId=${cmId}`);
      r.replyLinkUrl = { libType: typeof libR, lib: JSON.stringify(libR).slice(0, 120), dir: JSON.stringify(dirR).slice(0, 120) };
    }
    return r;
  }, qs);

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
