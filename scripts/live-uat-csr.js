/* CSR/admin UAT against dev.admin.www.bytecrtrs.com/csr — creds via env
 * (CSR_USER / CSR_PWD), never committed. READ-ONLY. Desktop viewport.
 *  - login (#73 permissions: can Customers/Orders load?)
 *  - customer search (#60)
 *  - open a user detail → tabs incl Notes & Messages (admin fix), Orders
 */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const SHOTS = '/tmp/uat-shots';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const SEARCH = process.env.CSR_SEARCH || 'test21@test21.com';
const out = []; const rec = (k, v) => out.push({ [k]: v });
const txt = (p) => p.locator('body').innerText();

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);

  // LOGIN
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/csr01-login.png` });
  const email = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i], input[name*="user" i]').first();
  const pwd = page.locator('input[type="password"]').first();
  await email.fill(USER).catch(() => {});
  await pwd.fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(5000);
  const tl = await txt(page);
  await page.screenshot({ path: `${SHOTS}/csr02-after-login.png`, fullPage: true });
  rec('login_73', { url: page.url().replace(BASE, ''),
    loggedIn: !/log ?in|sign ?in/i.test(page.url()),
    forbidden: /forbidden|unable to load|not authorized|access denied/i.test(tl),
    captcha: /input password/i.test(tl),
    customersVisible: /customers|users/i.test(tl),
    sample: tl.replace(/\s+/g, ' ').slice(0, 220) });

  // CUSTOMER SEARCH (#60)
  try {
    await page.goto(`${BASE}/csr/users`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const t0 = await txt(page);
    const forbidden = /forbidden|unable to load|not authorized|access denied/i.test(t0);
    // type into a search box
    const sb = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="email" i], input[type="text"]').first();
    if (await sb.count()) { await sb.fill(SEARCH); await sb.press('Enter').catch(() => {}); }
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(4000);
    const t1 = await txt(page);
    await page.screenshot({ path: `${SHOTS}/csr03-customer-search.png`, fullPage: true });
    rec('customer_search_60', { url: page.url().replace(BASE, ''), forbiddenOnLoad: forbidden,
      searchTerm: SEARCH, resultMentionsTerm: t1.toLowerCase().includes(SEARCH.toLowerCase()),
      rowCount: await page.locator('table tr, [role="row"], a[href*="/users/"]').count(),
      sample: t1.replace(/\s+/g, ' ').slice(0, 200) });
  } catch (e) { rec('customer_search_60', { error: e.message }); }

  // OPEN A USER DETAIL → tabs (Notes & Messages, Orders)
  try {
    const link = page.locator('a[href*="/users/"]').first();
    if (await link.count()) {
      await link.click(); await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(4000);
      const t = await txt(page);
      await page.screenshot({ path: `${SHOTS}/csr04-user-detail.png`, fullPage: true });
      const tabs = ['Orders', 'Payments', 'Searches', 'Reports', 'Logins', 'Notes', 'Messages', 'Audit', 'Actions']
        .filter(x => new RegExp(x, 'i').test(t));
      rec('user_detail', { url: page.url().replace(BASE, ''), whitePage: t.trim().length < 50,
        tabsPresent: tabs, hasNotesMessages: /notes\s*&?\s*messages|notes & messages/i.test(t) });

      // click Notes & Messages tab
      await page.getByText(/notes\s*&?\s*messages/i).first().click().catch(() => {});
      await page.waitForTimeout(3000);
      const tn = await txt(page);
      await page.screenshot({ path: `${SHOTS}/csr05-notes-messages.png`, fullPage: true });
      rec('notes_messages_tab', {
        notesSectionShown: /note|internal/i.test(tn),
        messagesSectionShown: /message|ticket|contact/i.test(tn),
        emptyBoth: /no notes|no messages|nothing here/i.test(tn),
        sample: tn.replace(/\s+/g, ' ').slice(0, 220) });
    } else rec('user_detail', { note: 'no user link to open' });
  } catch (e) { rec('user_detail', { error: e.message }); }

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
