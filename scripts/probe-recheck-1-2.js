/* Re-investigate ASK 1 (findAdmin / admins collection) and ASK 2 (tracking stability)
 * after the demo surfaced contradictions. READ-ONLY. Login-confirmed. Creds via env. */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const UID = process.env.TEST_USER_ID || '6a30a88dce24e4018b18e016';

(async () => {
  if (!USER || !PWD) { console.error('Set CSR_USER and CSR_PWD'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30000);
  let qs = '';
  page.on('request', (r) => { const u = r.url(); if (u.includes('/auth/login') && u.includes('?') && !qs) qs = u.slice(u.indexOf('?')); });
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => { if (window.CsrWrapper) return; await new Promise(r => { const s = document.createElement('script'); s.src = '/libs/csr-wrapper/index.iife.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); }); });
  let authed = false;
  for (let i = 0; i < 6; i++) { const ok = await page.evaluate(async () => { try { const c = window.CsrWrapper.getInstance({ endpointUrl: '/api' }); const r = await c.api.user.find.call(c.api.user, { brandId: 'idlookup', perPage: 3 }); const d = r?.getData ? r.getData() : r; return Array.isArray(d?.docs) && d.docs.length > 0; } catch { return false; } }); if (ok) { authed = true; break; } await page.waitForTimeout(2500); }
  if (!authed) { console.log(JSON.stringify({ FATAL: 'login not confirmed' })); await browser.close(); return; }

  const out = await page.evaluate(async ({ qs, UID }) => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const direct = async (body) => { try { const res = await fetch(`/api/database/search${qs}`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); const j = await res.json().catch(()=>null); const docs = Array.isArray(j?.docs)?j.docs:null; return { status: res.status, count: docs?docs.length:null, msg: j?.message||null, first: docs&&docs[0]?{ keys:Object.keys(docs[0]).slice(0,16), email:docs[0].email, roles:docs[0].roles, isAdmin:docs[0].isAdmin, brandId:docs[0].brandId, firstName:docs[0].firstName }:null, ids: docs?docs.map(d=>d._id).slice(0,12):null }; } catch(e){ return { thrown:e.message }; } };
    const trk = async (args) => { try { const r = await csr.api.tracking.findUser.call(csr.api.tracking, args); const d = r?.getData?r.getData():r; const docs=d?.docs||[]; return { count: docs.length, distinctUpdaters: [...new Set(docs.map(x=>x.updaterId))], allTarget: docs.length>0 && docs.every(x=>x.updaterId===UID) }; } catch(e){ return { thrown:e.message }; } };

    const R = { ask1: {}, ask2: {} };
    // ASK1: is `admins` the staff store, and is query.brandId the over-filter?
    R.ask1.admins_nofilter        = await direct({ collectionName:'admins', perPage:10 });
    R.ask1.admins_query_brandId   = await direct({ collectionName:'admins', query:{ brandId:'idlookup' }, perPage:10 }); // replicate findAdmin
    R.ask1.admins_toplevel_brandId= await direct({ collectionName:'admins', brandId:'idlookup', perPage:10 });
    R.ask1.users_nofilter         = await direct({ collectionName:'users', perPage:10 });
    R.ask1.admins_vs_users_overlap = (() => { const a=R.ask1.admins_nofilter.ids||[], u=R.ask1.users_nofilter.ids||[]; return a.filter(x=>u.includes(x)).length; })();
    // lib findAdmin result + (its body is known: {collectionName:'admins', query:{brandId}})
    R.ask1.lib_findAdmin = await (async () => { try { const r = await csr.api.user.findAdmin.call(csr.api.user, { brandId:'idlookup', perPage:10 }); const d=r?.getData?r.getData():r; const e=r?.getError?r.getError():null; return { count: (d?.docs||[]).length, status: e?.response?.status??200 }; } catch(e){ return { thrown:e.message }; } })();

    // ASK2: stability of tracking.findUser scoping across repeats
    R.ask2.lib_run1 = await trk({ type:'USER:login', updaterId: UID, perPage:100 });
    R.ask2.lib_run2 = await trk({ type:'USER:login', updaterId: UID, perPage:100 });
    R.ask2.lib_run3 = await trk({ type:'USER:login', updaterId: UID, perPage:100 });
    R.ask2.direct_toplevel = await direct({ collectionName:'trackings', query:{ 'data.type':'USER:login' }, updaterId: UID, perPage:100 });
    R.ask2.direct_distinctUpdaters = (() => { const ids = (R.ask2.direct_toplevel.ids||[]); return ids.length; })();
    return R;
  }, { qs, UID });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
