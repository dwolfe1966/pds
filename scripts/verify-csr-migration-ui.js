/* End-to-end UI verification of the lib-migration + role-gate fix against the
 * LOCAL prod admin bundle (localhost:3004/csr, /api proxied to BC).
 * Logs in as csrManager (local bundle has the role-gate fix), then drives:
 *   - Customers list loads (csrFindUsers → api.user.find)
 *   - search by email returns the matching row
 *   - open a customer → Orders tab renders (csrFindUserOrders → api.user.findOrders)
 * Creds via env. READ-ONLY (no writes/mutations).
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'http://localhost:3004';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const SEARCH = process.env.CSR_SEARCH || 'testingreg061526d@idlookup.ai';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);
  const rec = {};

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);
  const afterLogin = await page.locator('body').innerText();
  rec.login = { url: page.url().replace(BASE, ''),
    pastGate: !/access denied|admin credentials required/i.test(afterLogin) && !/\/login/.test(page.url()) };

  // Customers list (csrFindUsers → api.user.find)
  await page.goto(`${BASE}/csr/users`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const usersText = await page.locator('body').innerText();
  rec.customersList = {
    forbidden: /forbidden|invalid database search role|unable to load/i.test(usersText),
    rowish: await page.locator('table tr, [role="row"], a[href*="/users/"]').count(),
  };

  // Search by email
  const sb = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="email" i], input[type="text"]').first();
  if (await sb.count()) { await sb.fill(SEARCH); await sb.press('Enter').catch(() => {}); }
  await page.waitForTimeout(3500);
  const searchText = await page.locator('body').innerText();
  rec.searchByEmail = { term: SEARCH, mentionsTerm: searchText.toLowerCase().includes(SEARCH.toLowerCase()),
    rowish: await page.locator('a[href*="/users/"], table tr, [role="row"]').count() };

  // Open a customer → Orders
  const link = page.locator('a[href*="/users/"]').first();
  if (await link.count()) {
    await link.click().catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3500);
    const detailText = await page.locator('body').innerText();
    rec.customerDetail = {
      whitePage: detailText.trim().length < 50,
      tabs: ['Orders', 'Payments', 'Searches', 'Reports', 'Logins', 'Notes', 'Messages']
        .filter(t => new RegExp(t, 'i').test(detailText)),
      forbidden: /forbidden|invalid database search role/i.test(detailText),
    };
    await page.getByText(/^orders$/i).first().click().catch(() => {});
    await page.waitForTimeout(2500);
    const ot = await page.locator('body').innerText();
    rec.ordersTab = { mentionsOrderOrEmpty: /order|no orders|\$/i.test(ot),
      forbidden: /forbidden|invalid database search role/i.test(ot) };
  } else {
    rec.customerDetail = { note: 'no customer link to open' };
  }

  // Tickets inbox (csrFindContactMessages → api.message.contact.find) + open a thread
  // (csrFindContactHistories → api.message.contact.histories)
  await page.goto(`${BASE}/csr/tickets`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const tText = await page.locator('body').innerText();
  rec.ticketsInbox = {
    forbidden: /forbidden|invalid database search role|unable to load/i.test(tText),
    rowish: await page.locator('table tr, [role="row"], a[href*="ticket" i], li').count(),
    empty: /no tickets|no messages|nothing here/i.test(tText),
  };
  const trow = page.locator('table tbody tr, [role="row"], a[href*="ticket" i]').first();
  if (await trow.count()) {
    await trow.click().catch(() => {});
    await page.waitForTimeout(2500);
    const thText = await page.locator('body').innerText();
    rec.ticketThread = { opened: thText.trim().length > 80,
      forbidden: /forbidden|invalid database search role/i.test(thText) };
  }

  console.log(JSON.stringify(rec, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
