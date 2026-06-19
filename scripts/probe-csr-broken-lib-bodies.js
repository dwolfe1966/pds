/* "Super-specific why": capture the EXACT request body each broken lib method
 * sends to BC, vs the working direct body. csrManager session. READ-ONLY (finders).
 *   - user.findAdmin  → what does it POST to /database/search? (returns 0)
 *   - tracking.findUser → what does it POST? (drops updaterId/perPage scoping)
 * Login-confirmed. Creds via env.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const UID = '6a30a88dce24e4018b18e016';

(async () => {
  if (!USER || !PWD) { console.error('Set CSR_USER and CSR_PWD'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30000);

  let phase = 'login';
  const reqs = [];
  page.on('request', (req) => {
    if (/\/database\/search/.test(req.url()) && req.method() === 'POST') {
      let body = null; try { body = req.postData(); } catch {}
      reqs.push({ phase, body });
    }
  });

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => { if (window.CsrWrapper) return; await new Promise(r => { const s = document.createElement('script'); s.src = '/libs/csr-wrapper/index.iife.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); }); });
  let authed = false;
  for (let i = 0; i < 6; i++) { phase = 'confirm'; const ok = await page.evaluate(async () => { try { const c = window.CsrWrapper.getInstance({ endpointUrl: '/api' }); const r = await c.api.user.find.call(c.api.user, { brandId: 'idlookup', perPage: 3 }); const d = r?.getData ? r.getData() : r; return Array.isArray(d?.docs) && d.docs.length > 0; } catch { return false; } }); if (ok) { authed = true; break; } await page.waitForTimeout(2000); }
  if (!authed) { console.log(JSON.stringify({ FATAL: 'login not confirmed' })); await browser.close(); return; }

  const call = async (label, fnPath, args) => {
    phase = label;
    await page.evaluate(async ({ fnPath, args }) => {
      try { const c = window.CsrWrapper.getInstance({ endpointUrl: '/api' }); const p = fnPath.split('.'); let ctx = c.api, fn = c.api; for (const k of p) { ctx = fn; fn = fn?.[k]; } if (typeof fn === 'function') await fn.call(ctx, args); } catch {}
    }, { fnPath, args });
    await page.waitForTimeout(800);
  };

  await call('findAdmin', 'user.findAdmin', { brandId: 'idlookup', perPage: 10 });
  await call('userFind_isAdmin', 'user.find', { brandId: 'idlookup', isAdmin: true, perPage: 10 });
  await call('trackingFindUser', 'tracking.findUser', { type: 'USER:login', updaterId: UID, perPage: 100 });

  const byPhase = {};
  for (const r of reqs) { if (['login','confirm'].includes(r.phase)) continue; (byPhase[r.phase] = byPhase[r.phase] || []).push(r.body); }

  console.log(JSON.stringify({
    sent_by_each_lib_method: byPhase,
    working_direct_bodies_for_contrast: {
      findAdmin_works: { brandId: 'idlookup', collectionName: 'users', isAdmin: true, perPage: 10 },
      tracking_works: { collectionName: 'trackings', query: { 'data.type': 'USER:login' }, updaterId: UID, perPage: 100 },
    },
  }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
