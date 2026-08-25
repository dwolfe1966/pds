/* READ-ONLY focused pull for one user — does a trial/subscription CANCEL prevent the next charge?
 * Fetches Barbara Toledo's (payerId) orders + order histories + payments and prints the timeline:
 * the CANCEL transition (subStatus→canceled) vs. the charge attempts (esp. Aug 24), plus dueTimestamp.
 * NO mutations. Creds from env CSR_USER/CSR_PWD or docs/admin/BC-ADMIN-CREDENTIALS.rtf. Owner-present only.
 *   node scripts/csr-barbara-timeline.js  [payerId]
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.BC_BASE || 'https://admin.www.bytecrtrs.com';
const RTF_CREDS = path.join(ROOT, 'docs/admin/BC-ADMIN-CREDENTIALS.rtf');
const LOCAL_CREDS = path.join(ROOT, 'docs/BC_CREDS.local.md');
const PAYER = process.argv[2] || '6a8395d2a6897af5f9561567';
const OUT = path.join(ROOT, 'scripts/out/csr-barbara.json');

function loadCreds() {
  let user = process.env.CSR_USER, pwd = process.env.CSR_PWD;
  const grab = (t) => {
    const g = (labels) => { for (const l of labels) { const m = t.match(new RegExp(`${l}[^A-Za-z0-9]*[:=][^\\S\\r\\n]*\`?([^\`\\s]+)`, 'i')); if (m) return m[1]; } return null; };
    return { u: g(['CSR_USER', 'Email', 'User', 'Username']), p: g(['CSR_PWD', 'Password', 'Pass', 'PWD']) };
  };
  if ((!user || !pwd) && fs.existsSync(LOCAL_CREDS)) { const { u, p } = grab(fs.readFileSync(LOCAL_CREDS, 'utf8')); user = user || u; pwd = pwd || p; }
  if ((!user || !pwd) && fs.existsSync(RTF_CREDS)) {
    let txt = '';
    try { txt = require('child_process').execSync(`textutil -convert txt -stdout "${RTF_CREDS}"`, { encoding: 'utf8' }); }
    catch { txt = fs.readFileSync(RTF_CREDS, 'utf8').replace(/\\[a-z]+\d* ?|[{}]/g, ' '); }
    const lab = grab(txt);
    if (lab.u && lab.p) { user = user || lab.u; pwd = pwd || lab.p; }
    else { const paras = txt.split(/\n\s*\n/).map((s) => s.replace(/\s+/g, '')).filter(Boolean); const em = paras.find((s) => /@/.test(s)); const pw = paras.find((s) => s !== em && s.length >= 6); user = user || em; pwd = pwd || pw; }
  }
  return { user, pwd };
}

const ts = (v) => { const n = Number(v); if (!Number.isFinite(n) || n <= 0) return String(v ?? ''); return new Date(n < 1e12 ? n * 1000 : n).toISOString(); };

(async () => {
  const { user, pwd } = loadCreds();
  if (!user || !pwd) { console.error('✗ No CSR creds (env CSR_USER/CSR_PWD or docs/admin/BC-ADMIN-CREDENTIALS.rtf).'); process.exit(1); }
  console.error(`Base=${BASE}. Login as ${user.replace(/(.).*(@.*)/, '$1***$2')}… payer=${PAYER}`);
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(45000);
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(user).catch(() => {});
  await page.locator('input[type="password"]').first().fill(pwd).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => { for (const src of ['/libs/csr-wrapper/index.iife.js', '/libs/api-wrapper/index.iife.js']) { if ((src.includes('csr') && window.CsrWrapper) || (!src.includes('csr') && window.ApiWrapper)) continue; await new Promise((r) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = r; document.head.appendChild(s); }); } });
  const ready = await page.evaluate(() => { try { const c = window.CsrWrapper?.getInstance ? window.CsrWrapper.getInstance({ endpointUrl: '/api' }) : window.CsrWrapper; return !!c?.api?.user; } catch { return false; } });
  if (!ready) { console.error('✗ CsrWrapper not ready — creds likely expired or login flow changed.'); await browser.close(); process.exit(2); }
  console.error('Logged in. Pulling…');

  const rec = await page.evaluate(async (userId) => {
    const out = { userId, user: null, orders: [], historiesByOrder: {}, paymentsByOrder: {}, err: null };
    const c = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const gd = (x) => (x && typeof x.getData === 'function') ? x.getData() : x;
    try {
      try { out.user = gd(await c.api.user.find({ id: userId })) || gd(await c.api.user.getUser?.({ userId })); } catch (e) { out.userErr = e?.message; }
      const ord = gd(await c.api.user.findOrders({ userId }));
      out.orders = ord?.orders ?? ord?.data ?? (Array.isArray(ord) ? ord : []);
      for (const o of out.orders) {
        const oid = o?._id || o?.id; if (!oid) continue;
        try { const h = gd(await c.api.user.findOrderHistories({ orderId: oid })); out.historiesByOrder[oid] = h?.histories ?? h?.data ?? (Array.isArray(h) ? h : []); } catch (e) { out.historiesByOrder[oid] = { err: e?.message }; }
        try { const p = gd(await (c.api.user.findOrderPayments ? c.api.user.findOrderPayments({ orderId: oid }) : c.api.user.findPayments?.({ orderId: oid }))); out.paymentsByOrder[oid] = p?.payments ?? p?.data ?? (Array.isArray(p) ? p : (p || null)); } catch (e) { out.paymentsByOrder[oid] = { err: e?.message }; }
      }
    } catch (e) { out.err = e?.message || String(e); }
    return out;
  }, PAYER);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(rec, null, 2));
  console.error(`Raw dumped → ${OUT}\n`);

  // ── summary ──
  console.log(`USER status: ${rec.user?.status || rec.user?.data?.status || '(?)'}  err=${rec.userErr || ''}`);
  console.log(`ORDERS: ${rec.orders.length}\n`);
  for (const o of rec.orders) {
    const oid = o._id || o.id;
    const sched = o.schedule?.data || o.transient?.schedule?.data || {};
    console.log(`── order ${String(oid).slice(-8)} ──`);
    console.log(`   status=${o.status}  subStatus=${o.subStatus}  canceled(transient)=${o.transient?.canceled}`);
    console.log(`   dueTimestamp=${ts(o.dueTimestamp)}  sequence=${sched.sequence}  totalPrice=${sched.totalPrice}  collected=${o.transient?.amount?.collected}`);
    const pays = Array.isArray(rec.paymentsByOrder[oid]) ? rec.paymentsByOrder[oid] : (o.commercePayments || []);
    console.log(`   PAYMENT ATTEMPTS (${Array.isArray(pays) ? pays.length : 0}):`);
    (Array.isArray(pays) ? pays : []).forEach((p) => console.log(`     ${ts(p.timestamp || p.createdTimestamp || p.updatedTimestamp)}  type=${p.type}  status=${p.status}  collected=${p.collected ?? p.amount?.collected}  reason=${p.statusReason || p.reason || ''}`));
    const hist = Array.isArray(rec.historiesByOrder[oid]) ? rec.historiesByOrder[oid] : [];
    console.log(`   HISTORY (${hist.length}) — cancel/subStatus transitions:`);
    hist.forEach((h) => { const s = JSON.stringify(h).slice(0, 160); if (/cancel|subStatus|status/i.test(s)) console.log(`     ${ts(h.timestamp || h.createdTimestamp || h.updatedTimestamp)}  ${s}`); });
    console.log('');
  }
  await browser.close();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
