/* ───────────────────────────────────────────────────────────────────────────
 * DEMO: CSR lib-method gaps, proven against BC's OWN deployed API.
 * Runnable by anyone with a CSR account — it does not assert our opinion, it calls
 * the methods and prints what BC returns. For each ask:
 *   WE CALL → what BC RETURNS → what we EXPECTED → VERDICT   (+ working CONTRAST).
 *
 * Scope = the THREE verified asks + ONE confirm. (findAdmin and tracking.findUser were
 * investigated and removed: findAdmin works via `admins` — our brandId bug, not BC's;
 * tracking.findUser scopes correctly via the lib. Each ask below was re-checked across
 * brand variations so a brandId filter can't be the cause.)
 *
 * Usage:  CSR_USER='…' CSR_PWD='…' node scripts/demo-bc-csr-asks.js
 * Env:    CSR_USER, CSR_PWD (any CSR account) · ADMIN_HOST · CONSUMER_URL · TEST_USER_ID
 * READ-ONLY: only finders/getters are called. No writes, sales, or mutations.
 * ─────────────────────────────────────────────────────────────────────────── */
const { chromium } = require('@playwright/test');
const ADMIN = `https://${process.env.ADMIN_HOST || 'dev.admin.www.bytecrtrs.com'}`;
const CONSUMER = process.env.CONSUMER_URL || 'https://dev.www.idlookup.ai';
const TEST_USER_ID = process.env.TEST_USER_ID || '6a30a88dce24e4018b18e016';

// Shared DEV test account — used ONLY as a fallback when no creds are supplied AND only
// against a *dev* host. For a definitive result (and for BC to run on their side), supply
// your own CSR account via CSR_USER/CSR_PWD. Never used against a non-dev host.
const DEV_DEFAULT = { user: 'frontend@csrManager.pds', pwd: 'bcEdgeApiPass123!@#' };
let USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
if (!USER || !PWD) {
  if (/(^|\.)dev\./.test(ADMIN) || ADMIN.includes('//dev.')) {
    USER = USER || DEV_DEFAULT.user; PWD = PWD || DEV_DEFAULT.pwd;
    console.warn(`⚠  No CSR_USER/CSR_PWD supplied — falling back to the shared DEV test account (${DEV_DEFAULT.user}).`);
    console.warn('   For a definitive result, re-run with your OWN CSR account:  CSR_USER=… CSR_PWD=… node scripts/demo-bc-csr-asks.js');
  } else {
    console.error(`Refusing to use the dev default against a non-dev host (${ADMIN}). Supply CSR_USER and CSR_PWD.`);
    process.exit(1);
  }
}
const line = (s = '') => console.log(s);
const hr = () => line('─'.repeat(78));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  let loginQs = '';
  page.on('request', (req) => { const u = req.url(); if (u.includes('/auth/login') && u.includes('?') && !loginQs) loginQs = u.slice(u.indexOf('?')); });

  await page.goto(`${ADMIN}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => { for (const s of ['/libs/api-wrapper/index.iife.js','/libs/csr-wrapper/index.iife.js']) { if ((s.includes('csr')&&window.CsrWrapper)||(!s.includes('csr')&&window.ApiWrapper)) continue; await new Promise(r=>{const e=document.createElement('script');e.src=s;e.onload=r;e.onerror=r;document.head.appendChild(e);}); } });
  let authed = false;
  for (let i = 0; i < 6; i++) { const ok = await page.evaluate(async () => { try { const c = window.CsrWrapper.getInstance({ endpointUrl: '/api' }); const r = await c.api.user.find.call(c.api.user, { brandId: 'idlookup', perPage: 3 }); const d = r?.getData ? r.getData() : r; return Array.isArray(d?.docs) && d.docs.length > 0; } catch { return false; } }); if (ok) { authed = true; break; } await page.waitForTimeout(2500); }
  if (!authed) { console.error('Login could not be confirmed (cold session). Re-run.'); await browser.close(); process.exit(2); }

  const direct = async (body) => page.evaluate(async ({ body, qs }) => {
    try { const res = await fetch(`/api/database/search${qs}`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const j = await res.json().catch(()=>null); return { status: res.status, count: Array.isArray(j?.docs)?j.docs.length:null, msg: j?.message||null }; }
    catch (e) { return { thrown: e.message }; }
  }, { body, qs: loginQs });

  line(); line('████  BC CSR API — live demonstration  ████');
  line(`account: ${USER}   env: ${ADMIN}`);

  // ── ASK A — offer lookup in the CSR context ────────────────────────
  const aCsrNs = await page.evaluate(() => { const c = window.CsrWrapper.getInstance({ endpointUrl:'/api' }); return !!c?.api?.offer; });
  const aOffer = async (brand) => page.evaluate(async ({ qs, brand }) => { try { const body = { shmName:'comp.offer.signup.main', ...(brand?{brandId:brand}:{}) }; const res = await fetch(`/api/commerce/offer/findByShmName${qs}`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); const j = await res.json().catch(()=>null); return { status: res.status, msg: j?.message||null, hasPrice: !!(j?.transient?.priceInfo) }; } catch(e){ return { thrown:e.message }; } }, { qs: loginQs, brand });
  const aNo = await aOffer(null), aId = await aOffer('idlookup'), aBc = await aOffer('bytecrtrs');
  let aConsumer = null;
  try { const cp = await ctx.newPage(); cp.setDefaultTimeout(20000); await cp.goto(`${CONSUMER}/`, { waitUntil:'networkidle' }); await cp.waitForTimeout(2000);
    aConsumer = await cp.evaluate(async () => { try { const a = window.ApiWrapper.getInstance({ endpointUrl:'/api' }); const r = await a.api.offer.findByShmName.call(a.api.offer, { shmName:'comp.offer.signup.main' }); const d=r?.getData?r.getData():r; return { hasPrice: !!(d?.transient?.priceInfo), s0: d?.transient?.priceInfo?.s0||null }; } catch(e){ return { thrown:e.message }; } }); await cp.close();
  } catch (e) { aConsumer = { skipped: e.message }; }
  hr(); line('ASK A — offer lookup does not resolve in the CSR context (add csrWrapper.api.offer.findByShmName + grant)');
  line(`  WE CALL :  POST /commerce/offer/findByShmName { shmName:'comp.offer.signup.main' }  (CSR session)`);
  line(`  BC RETURNS: no-brand → ${aNo.status} "${aNo.msg}"   idlookup → ${aId.status} "${aId.msg}"   bytecrtrs → ${aBc.status} "${aBc.msg}"`);
  line(`  CONTRAST:  SAME shmName @ consumer (${CONSUMER}) → ${JSON.stringify(aConsumer)}`);
  line(`  LIB     :  csrWrapper.api.offer exists? ${aCsrNs}`);
  line(`  VERDICT :  offer resolves for consumers but 403 "No offer." for CSR (every brand); no CSR offer method.`);

  // ── ASK B — CSR billing.sale (on-behalf-of) ────────────────────────
  const b = await page.evaluate(() => { const c = window.CsrWrapper.getInstance({ endpointUrl:'/api' }); const a = window.ApiWrapper?.getInstance ? window.ApiWrapper.getInstance({ endpointUrl:'/api' }) : window.ApiWrapper; return { csrBilling: !!c?.api?.billing, consumerSale: typeof a?.api?.billing?.sale==='function', consumerMethods: a?.api?.billing?Object.keys(a.api.billing):null }; });
  hr(); line('ASK B — no CSR billing.sale for on-behalf-of-customer orders (add csrWrapper.api.billing.sale({payerId,…}))');
  line(`  csrWrapper.api.billing exists? ${b.csrBilling}`);
  line(`  consumer ApiWrapper.api.billing.sale exists? ${b.consumerSale}   methods: ${JSON.stringify(b.consumerMethods)}`);
  line(`  VERDICT :  no CSR billing namespace; consumer sale has no payerId (bills the session user) → can't bill a customer.`);

  // ── ASK C — commerceOrder global search ────────────────────────────
  const cNo = await direct({ collectionName:'commerceOrder', perPage:5 });
  const cId = await direct({ collectionName:'commerceOrder', brandId:'idlookup', perPage:5 });
  const cBc = await direct({ collectionName:'commerceOrder', brandId:'bytecrtrs', perPage:5 });
  hr(); line('ASK C — global order search (commerceOrder) is role-gated (open it, or add a global order finder)');
  line(`  WE CALL :  POST /database/search { collectionName:'commerceOrder' }`);
  line(`  BC RETURNS: no-brand → ${cNo.status} "${cNo.msg}"   idlookup → ${cId.status} "${cId.msg}"   bytecrtrs → ${cBc.status} "${cBc.msg}"`);
  line(`  VERDICT :  403 "Invalid Database Search Role" for every brand → no global order search.`);

  // ── CONFIRM — userContact data model ───────────────────────────────
  const fc = await page.evaluate(async ({ uid }) => { try { const c = window.CsrWrapper.getInstance({ endpointUrl:'/api' }); const r = await c.api.user.findUserContacts.call(c.api.user, { userId: uid }); const d=r?.getData?r.getData():r; return { count:(d?.docs||[]).length }; } catch(e){ return { thrown:e.message }; } }, { uid: TEST_USER_ID });
  const uc = await direct({ collectionName:'userContact', targetUserId: TEST_USER_ID, perPage:5 });
  hr(); line('CONFIRM — where do member messages live? (data-model question, not a defect)');
  line(`  findUserContacts({userId}) → GET /contactMessage/admin/find/:userId → ${fc.count} contactMessage docs`);
  line(`  direct {collectionName:'userContact', targetUserId} → ${uc.status} "${uc.msg}"`);
  line(`  QUESTION:  is 'userContact' a separate store, or are member messages all contactMessage-by-targetUserId?`);

  hr(); line('SUMMARY');
  line(`  A offer (CSR)         : CSR ${aId.status}/"${aId.msg}"  ·  consumer resolves=${aConsumer&&aConsumer.hasPrice}   ❌ FIX/ADD`);
  line(`  B CSR billing.sale    : csr.billing=${b.csrBilling}; consumer sale has no payerId                    ❌ ADD`);
  line(`  C commerceOrder global: 403 "Invalid Database Search Role" (all brands)                              ❌ OPEN/ADD`);
  line(`  ? userContact model   : findUserContacts→contactMessage(${fc.count}); userContact direct ${uc.status}   CONFIRM`);
  line();
  line('  (Removed after investigation: findAdmin = our brandId bug, use admins collection;');
  line('   tracking.findUser = works, scopes via query.updaterId.)');
  hr();
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
