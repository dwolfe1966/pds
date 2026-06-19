/* (b) Pin WHY offer lookup fails in the CSR/admin context: role gate vs brand/clientId
 * scoping. csrManager session; tries /commerce/offer/findByShmName (direct, login-auth)
 * and ApiWrapper.offer.findByShmName with brand/key variations. If a brand change makes
 * it resolve → brand scoping; if uniformly 403 → role/clientId gate. READ-ONLY.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;

(async () => {
  if (!USER || !PWD) { console.error('Set CSR_USER and CSR_PWD'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30000);
  let qs = '';
  page.on('request', (req) => { const u = req.url(); if (u.includes('/auth/login') && u.includes('?') && !qs) qs = u.slice(u.indexOf('?')); });

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => { for (const s of ['/libs/api-wrapper/index.iife.js','/libs/csr-wrapper/index.iife.js']) { if ((s.includes('csr')&&window.CsrWrapper)||(!s.includes('csr')&&window.ApiWrapper)) continue; await new Promise(r=>{const e=document.createElement('script');e.src=s;e.onload=r;e.onerror=r;document.head.appendChild(e);}); } });
  let authed = false;
  for (let i = 0; i < 6; i++) { const ok = await page.evaluate(async () => { try { const c = window.CsrWrapper.getInstance({ endpointUrl: '/api' }); const r = await c.api.user.find.call(c.api.user, { brandId: 'idlookup', perPage: 3 }); const d = r?.getData ? r.getData() : r; return Array.isArray(d?.docs) && d.docs.length > 0; } catch { return false; } }); if (ok) { authed = true; break; } await page.waitForTimeout(2000); }
  if (!authed) { console.log(JSON.stringify({ FATAL: 'login not confirmed' })); await browser.close(); return; }

  const out = await page.evaluate(async ({ qs }) => {
    const post = async (body) => {
      try { const res = await fetch(`/api/commerce/offer/findByShmName${qs}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await res.json().catch(() => null);
        return { status: res.status, msg: j?.message || null, hasPrice: !!(j?.transient?.priceInfo), keys: j && typeof j === 'object' ? Object.keys(j).slice(0,6) : typeof j }; }
      catch (e) { return { thrown: e.message }; }
    };
    const R = { direct: {}, contrastReads: {} };
    // brand / key variations on the offer call
    R.direct['signup.main no-brand']   = await post({ shmName: 'comp.offer.signup.main' });
    R.direct['signup.main idlookup']   = await post({ shmName: 'comp.offer.signup.main', brandId: 'idlookup' });
    R.direct['signup.main bytecrtrs']  = await post({ shmName: 'comp.offer.signup.main', brandId: 'bytecrtrs' });
    R.direct['signup key=main']        = await post({ shmName: 'comp.offer.signup', key: 'main' });
    R.direct['agent.retention idlk']   = await post({ shmName: 'comp.offer.agent.retention', brandId: 'idlookup' });
    // Contrast: do OTHER /commerce/* or brand-scoped reads work in this same session?
    // (If users/orders read fine but offer 403s, it's offer-specific, not a blanket gate.)
    const get = async (path) => { try { const r = await fetch(`/api${path}${qs}`, { credentials: 'include' }); return { status: r.status }; } catch (e) { return { thrown: e.message }; } };
    R.contrastReads['shape getBrandIds'] = await (async () => { try { const c = window.CsrWrapper.getInstance({ endpointUrl:'/api' }); const r = await c.api.shape.getBrandIds.call(c.api.shape, {}); const e = r?.getError?r.getError():null; return { ok: !e, status: e?.response?.status ?? 200 }; } catch(e){ return { thrown: e.message }; } })();
    return R;
  }, { qs });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
