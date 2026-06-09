/* UAT: confirm consumer→CSR messages now appear on the CSR user-detail page
 * (Messages/tickets section), via the local rebuilt admin bundle (:3004, /api → BC).
 * Strategy: read a sender email from the general inbox, find the matching customer,
 * open their detail, and confirm the per-user contact-messages fetch returns > 0
 * (intercept admin-find-user-contact-messages response). READ-ONLY.
 *
 *   npm run build:admin && node scripts/serve-admin-prod.js   # background
 *   node scripts/live-uat-user-messages.js
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(function loadSmokeEnv() {
  const f = path.join(__dirname, '.smoke.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let val = m[2].trim().replace(/^['"‘’“”]|['"‘’“”]$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
})();

const BASE = process.env.LOCAL_ADMIN || 'http://localhost:3004';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const out = { ran: true };

(async () => {
  if (!USER || !PWD) { console.log(JSON.stringify({ ran: false, note: 'no CSR creds' })); return; }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  // capture inbox + per-user contact-message API responses
  let inboxEmails = [];
  let perUserResult = null;
  page.on('response', async (resp) => {
    const u = resp.url();
    try {
      if (/\/contactMessage\/admin\/find(\?|$)/.test(u)) {
        const j = await resp.json().catch(() => ({}));
        const docs = j?.docs ?? j?.data ?? [];
        inboxEmails = [...new Set(docs.map((d) => (d?.content?.input?.email || d?.content?.email || '').toLowerCase()).filter(Boolean))];
      }
      if (/\/contactMessage\/admin\/find\/[A-Za-z0-9]+/.test(u)) {
        const j = await resp.json().catch(() => ({}));
        perUserResult = { count: (j?.docs ?? j?.data ?? []).length };
      }
    } catch {}
  });

  // LOGIN
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"], input[name*="email" i], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);
  out.loggedIn = !/\/login/.test(page.url());

  // 1) open the general inbox (EmailTicketsPage) to learn sender emails
  await page.goto(`${BASE}/csr/tickets`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(4000);
  out.inboxSenderEmails = inboxEmails.slice(0, 8);

  // 2) for each sender email, see if a matching customer exists; open the first hit
  for (const email of inboxEmails.slice(0, 6)) {
    await page.goto(`${BASE}/csr/users`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const sb = page.locator('input[type="search"], input[placeholder*="search" i], input[type="text"]').first();
    await sb.fill(email);
    await sb.press('Enter').catch(() => {});
    await page.waitForTimeout(3000);
    // click the first customer row/card if present
    const row = page.locator('a[href*="/users/"], tr[role="button"], [class*="card" i]').first();
    if (await row.count()) {
      perUserResult = null;
      await row.click().catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(4000);
      const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      out.matched = {
        email,
        url: page.url().replace(BASE, ''),
        perUserApiCount: perUserResult?.count ?? 'no per-user API call seen',
        bodyMentionsMessages: /message|ticket|contacted|subject/i.test(body),
        bodySample: body.slice(0, 240),
      };
      await page.screenshot({ path: '/tmp/uat-user-messages.png', fullPage: true }).catch(() => {});
      break;
    }
  }
  if (!out.matched) out.note = 'no customer matched any inbox sender email (senders may not be registered members)';

  console.log('===== USER-MESSAGES UAT =====');
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
