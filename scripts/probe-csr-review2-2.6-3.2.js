/* Follow-up: nail 2.6 (offer lookup) and 3.2 (tracking scope/perPage).
 * 2.6: try the DIRECT CSR endpoint /commerce/offer/findByShmName (what we use today) +
 *      ApiWrapper.offer.findByShmName with shmName/key variations.
 * 3.2: does tracking.findUser({targetUserId}) actually return the TARGET user's events,
 *      and does perPage lift past 10? Inspect per-doc updaterId.
 * Read-only. Login-confirmed. Creds via env.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const USER_ID = process.argv[2] || '6a30a88dce24e4018b18e016';

(async () => {
  if (!USER || !PWD) { console.error('Set CSR_USER and CSR_PWD'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30000);
  let loginQs = '';
  page.on('request', (req) => { const u = req.url(); if (u.includes('/auth/login') && u.includes('?') && !loginQs) loginQs = u.slice(u.indexOf('?')); });

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => { for (const src of ['/libs/api-wrapper/index.iife.js', '/libs/csr-wrapper/index.iife.js']) { if ((src.includes('csr') && window.CsrWrapper) || (!src.includes('csr') && window.ApiWrapper)) continue; await new Promise((r) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = r; document.head.appendChild(s); }); } });
  let authed = false;
  for (let i = 0; i < 6; i++) { const ok = await page.evaluate(async () => { try { const c = window.CsrWrapper.getInstance({ endpointUrl: '/api' }); const r = await c.api.user.find.call(c.api.user, { brandId: 'idlookup', perPage: 3 }); const d = r?.getData ? r.getData() : r; return Array.isArray(d?.docs) && d.docs.length > 0; } catch { return false; } }); if (ok) { authed = true; break; } await page.waitForTimeout(2000); }
  if (!authed) { console.log(JSON.stringify({ FATAL: 'login not confirmed' })); await browser.close(); return; }

  const out = await page.evaluate(async ({ qs, userId }) => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const api = window.ApiWrapper?.getInstance ? window.ApiWrapper.getInstance({ endpointUrl: '/api' }) : window.ApiWrapper;
    const R = {};

    // ---- 2.6 DIRECT CSR offer endpoint (what we use today) ----
    const offerDirect = async (body) => { try { const res = await fetch(`/api/commerce/offer/findByShmName${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await res.json().catch(() => null); return { status: res.status, msg: j?.message || null, hasPriceInfo: !!(j?.transient?.priceInfo), keys: j && typeof j === 'object' ? Object.keys(j).slice(0, 8) : typeof j }; } catch (e) { return { thrown: e.message }; } };
    R['2.6_direct'] = {
      signup_main: await offerDirect({ shmName: 'comp.offer.signup.main' }),
      signup_key: await offerDirect({ shmName: 'comp.offer.signup', key: 'main' }),
      agent_retention: await offerDirect({ shmName: 'comp.offer.agent.retention' }),
      agent_comp: await offerDirect({ shmName: 'comp.offer.agent.comp' }),
    };
    // ApiWrapper.offer variations
    const offerLib = async (args) => { try { const r = await api.api.offer.findByShmName.call(api.api.offer, args); const d = r?.getData ? r.getData() : r; const e = r?.getError ? r.getError() : null; return { err: e?.response?.data?.message || e?.message || null, hasPriceInfo: !!(d?.transient?.priceInfo), keys: d && typeof d === 'object' ? Object.keys(d).slice(0, 8) : typeof d }; } catch (e) { return { thrown: e.message }; } };
    R['2.6_ApiWrapper'] = {
      signup_main: await offerLib({ shmName: 'comp.offer.signup.main' }),
      signup_key: await offerLib({ shmName: 'comp.offer.signup', key: 'main' }),
      agent_retention: await offerLib({ shmName: 'comp.offer.agent.retention' }),
    };

    // ---- 3.2 tracking scope + perPage ----
    const trk = async (args) => { try { const r = await csr.api.tracking.findUser.call(csr.api.tracking, args); const d = r?.getData ? r.getData() : r; const docs = d?.docs || []; const updaterIds = [...new Set(docs.map(x => x.updaterId))]; return { count: docs.length, distinctUpdaterIds: updaterIds.length, allMatchTarget: docs.length > 0 && docs.every(x => x.updaterId === userId), sampleUpdaterIds: updaterIds.slice(0, 3) }; } catch (e) { return { thrown: e.message }; } };
    R['3.2'] = {
      targetUserId_pp100: await trk({ type: 'USER:login', targetUserId: userId, perPage: 100 }),
      targetUserId_pp10: await trk({ type: 'USER:login', targetUserId: userId, perPage: 10 }),
      userId_pp100: await trk({ type: 'USER:login', userId: userId, perPage: 100 }),
      noType_targetUserId_pp100: await trk({ targetUserId: userId, perPage: 100 }),
    };
    return R;
  }, { qs: loginQs, userId: USER_ID });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
