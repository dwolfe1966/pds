/* Pre-migration filter verification (2026-06-22) for the direct-only reads we want to
 * move to lib-first: managedContact.find (must honor type:'email'|'phone' + contactAddress)
 * and optOut.find. docCount alone is NOT enough — a lib that ignores the filter would
 * return the wrong rows with a valid shape (the 2026-06-12 revert class). Auth-gated.
 * READ-ONLY. Usage: CSR_USER=… CSR_PWD=… node scripts/probe-csr-migrate-filters-verify.js
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
    const isUsableList = (r) => Array.isArray(r) || (r && typeof r === 'object' && (Array.isArray(r.docs) || Array.isArray(r.data)));
    // auth gate
    let ok = false; for (let i = 0; i < 8; i++) { try { const u = unwrap(await csr.api.user.find.call(csr.api.user, { brandId: 'idlookup', perPage: 5 })); if ((u?.docs || []).length) { ok = true; break; } } catch {} await new Promise(r => setTimeout(r, 2000)); }
    if (!ok) return { ABORT: 'auth not confirmed' };

    const mc = async (args) => { try { const d = unwrap(await csr.api.managedContact.find.call(csr.api.managedContact, args)); const docs = d?.docs || []; return { usableList: isUsableList(d), docCount: docs.length, sampleTypes: [...new Set(docs.slice(0, 10).map(x => x.type || x.contactType))], sample: docs.slice(0, 3).map(x => ({ type: x.type || x.contactType, value: x.contactAddress || x.value || x.address || x.email || x.phone, keys: Object.keys(x).slice(0, 10) })) }; } catch (e) { return { thrown: e.message }; } };
    const oo = async (args) => { try { const d = unwrap(await csr.api.optOut.find.call(csr.api.optOut, args)); const docs = d?.docs || []; return { usableList: isUsableList(d), docCount: docs.length, topKeys: d && typeof d === 'object' ? Object.keys(d).slice(0, 8) : typeof d }; } catch (e) { return { thrown: e.message }; } };

    return {
      mc_all: await mc({ perPage: 10 }),
      mc_email: await mc({ type: 'email', perPage: 10 }),
      mc_phone: await mc({ type: 'phone', perPage: 10 }),
      optOut: await oo({ brandId: 'idlookup', perPage: 10 }),
      optOut_noBrand: await oo({ perPage: 10 }),
    };
  });

  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
