/* One-off probe: capture the raw BC /auth/login response for a CSR account.
 * Creds via env (CSR_USER / CSR_PWD), never committed. READ-ONLY.
 * Goal: see exactly what fields BC returns (role? roles[]? permissions[]?)
 * so the apiRouter role-mapping can admit CSR accounts without an allowlist.
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);

  const captured = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (/auth\/login|\/login\b/i.test(url) && res.request().method() === 'POST') {
      let body = null;
      try { body = await res.json(); } catch { try { body = await res.text(); } catch {} }
      captured.push({ url: url.replace(BASE, ''), status: res.status(), body });
    }
  });

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const email = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i], input[name*="user" i]').first();
  const pwd = page.locator('input[type="password"]').first();
  await email.fill(USER).catch(() => {});
  await pwd.fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(5000);

  // Redact tokens before printing.
  const redact = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const clone = Array.isArray(obj) ? [...obj] : { ...obj };
    for (const k of Object.keys(clone)) {
      if (/token|jwt|password|secret/i.test(k) && typeof clone[k] === 'string') clone[k] = `<${clone[k].length}-char ${k}>`;
      else if (clone[k] && typeof clone[k] === 'object') clone[k] = redact(clone[k]);
    }
    return clone;
  };

  // Now test a REAL CSR data call on the authenticated session: the users-list
  // POST /api/database/search. 200-with-rows = CSR data access works; 403 = the
  // account's permission profile can't read CSR collections (BC-side provisioning).
  const loginUrl = captured[0]?.url || '';
  const qs = loginUrl.includes('?') ? loginUrl.slice(loginUrl.indexOf('?')) : '';
  let dataProbe = { skipped: true };
  try {
    const res = await page.request.post(`${BASE}/api/database/search${qs}`, {
      headers: { 'Content-Type': 'application/json' },
      data: { brandId: 'idlookup', collectionName: 'users', query: {}, perPage: 5 },
    });
    let body = null;
    try { body = await res.json(); } catch { body = await res.text(); }
    const rows = body && (Array.isArray(body) ? body : (body.docs || body.data || body.users || body.results));
    dataProbe = {
      status: res.status(),
      ok: res.ok(),
      rowCount: Array.isArray(rows) ? rows.length : null,
      sample: typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300),
    };
  } catch (e) { dataProbe = { error: e.message }; }

  console.log(JSON.stringify({
    login: captured.map(c => ({ ...c, body: redact(c.body) })),
    dataProbe,
  }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
