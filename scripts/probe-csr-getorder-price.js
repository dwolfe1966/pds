/* Kwan's Ask-A redirect (mtg 2026-06-23): use csrWrapper.api.user.getOrder for NAME +
 * schedule/upcoming-billing → definitive price for the CSR (instead of offer.findByShmName).
 * This probe VERIFIES getOrder actually carries that data and captures the exact field paths
 * so we can wire the UserDetailPage price panel. Auth-gated (un-authed sessions blanket-403).
 * READ-ONLY. Usage: CSR_USER=… CSR_PWD=… node scripts/probe-csr-getorder-price.js
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;

(async () => {
  if (!USER || !PWD) { console.error('Set CSR_USER and CSR_PWD'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30000);
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);
  await page.evaluate(async () => { if (window.CsrWrapper) return; await new Promise((r) => { const s = document.createElement('script'); s.src = '/libs/csr-wrapper/index.iife.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); }); });

  const out = await page.evaluate(async () => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const unwrap = (r) => (r && r.getData ? r.getData() : r);
    // auth gate: don't trust results until user.find returns docs
    let ok = false, users = [];
    for (let i = 0; i < 8; i++) { try { const u = unwrap(await csr.api.user.find.call(csr.api.user, { brandId: 'idlookup', perPage: 25 })); users = u?.docs || []; if (users.length) { ok = true; break; } } catch {} await new Promise(r => setTimeout(r, 2000)); }
    if (!ok) return { ABORT: 'auth not confirmed' };

    // find a user that has an order
    let target = null, orderId = null, orderListShape = null;
    for (const u of users.slice(0, 20)) {
      try {
        const o = unwrap(await csr.api.user.findOrders.call(csr.api.user, { userId: u._id }));
        const ords = o?.orders || o?.docs || [];
        if (ords.length) { target = u; orderId = ords[0]._id || ords[0].id; orderListShape = { keys: Object.keys(ords[0]).slice(0, 25), sample: ords[0] }; break; }
      } catch {}
    }
    if (!orderId) return { ABORT: 'no user with orders found in first 20', usersScanned: users.length };

    // THE call Kwan points us at
    const raw = unwrap(await csr.api.user.getOrder.call(csr.api.user, { userId: target._id, orderId }));
    const order = raw?.order || raw?.doc || raw;

    // hunt for name + price/schedule/billing fields
    const pick = (obj, keys) => keys.reduce((a, k) => (obj && obj[k] !== undefined ? (a[k] = obj[k], a) : a), {});
    return {
      authConfirmed: true,
      userId: target._id.slice(-6),
      userName: pick(target, ['firstName', 'lastName', 'name', 'fullName', 'email']),
      orderId: orderId.slice(-6),
      findOrders_itemKeys: orderListShape?.keys,
      getOrder_topKeys: raw && typeof raw === 'object' ? Object.keys(raw).slice(0, 30) : typeof raw,
      getOrder_orderKeys: order && typeof order === 'object' ? Object.keys(order).slice(0, 40) : typeof order,
      // candidate definitive-price/schedule fields
      priceish: pick(order || {}, ['subStatus', 'status', 'dueTimestamp', 'dueAmount', 'amount', 'nextBillingDate', 'nextBillingAmount', 'schedule', 'schedules', 'billingSeries', 'productType', 'extName', 'offerShmName', 'priceInfo', 'transient', 'collected', 'total', 'sequenceOption']),
      // dump the full order (trimmed) so we can read nested schedule/billing paths
      fullOrder: order,
    };
  });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
