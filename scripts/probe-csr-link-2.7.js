/* Item 2.7 (link a visitor contact to a user): BC says use message.contact.replyLinkUrl.
 * This proves replyLinkUrl just RETURNS A URL (read-only, no targetUserId, no linking),
 * and confirms message.contact.setTargetUser exists (the actual link method).
 * READ-ONLY: calls replyLinkUrl (a getter) only; does NOT call setTargetUser /
 * changeContactToUserContact (those mutate a record). Creds via env.
 * Usage: CSR_USER=… CSR_PWD=… node scripts/probe-csr-link-2.7.js [messageId]
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const MSG_ID = process.argv[2] || '6a31ca36f009300c72f299b2';

(async () => {
  if (!USER || !PWD) { console.error('Set CSR_USER and CSR_PWD'); process.exit(1); }
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30000);
  const urls = [];
  page.on('request', (req) => { const u = req.url(); if (/contactMessage|changeContact|setTargetUser/i.test(u)) urls.push({ method: req.method(), path: u.replace(BASE, '').split('?')[0] }); });

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await page.evaluate(async () => { if (window.CsrWrapper) return; await new Promise((r) => { const s = document.createElement('script'); s.src = '/libs/csr-wrapper/index.iife.js'; s.onload = r; s.onerror = r; document.head.appendChild(s); }); });

  const out = await page.evaluate(async ({ msgId }) => {
    const csr = window.CsrWrapper.getInstance({ endpointUrl: '/api' });
    const r = {};
    // replyLinkUrl — what does it actually return?
    try {
      const res = await csr.api.message.contact.replyLinkUrl.call(csr.api.message.contact, { messageId: msgId });
      const err = res?.getError ? res.getError() : null; const d = res?.getData ? res.getData() : res;
      r.replyLinkUrl = { errMsg: err?.response?.data?.message || err?.message || null, dataType: typeof d,
        value: typeof d === 'string' ? d : (d && typeof d === 'object' ? { keys: Object.keys(d).slice(0, 8), sample: JSON.stringify(d).slice(0, 200) } : d) };
    } catch (e) { r.replyLinkUrl = { thrown: e.message }; }
    // existence (NOT called): setTargetUser vs changeContactToUserContact
    r.has_setTargetUser = typeof csr?.api?.message?.contact?.setTargetUser === 'function';
    r.has_contact_namespace = !!csr?.api?.contact;
    r.has_changeContactToUserContact = typeof csr?.api?.contact?.changeContactToUserContact === 'function';
    return r;
  }, { msgId: MSG_ID });

  console.log(JSON.stringify({ ...out, urlsHit: urls }, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
