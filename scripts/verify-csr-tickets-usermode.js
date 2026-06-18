/* UI verification of the EmailTicketsPage USER-MODE fix (the path that threw
 * "Failed to load contacts" on the userContact 403). Logs in as csrManager
 * against the LOCAL prod admin bundle, opens /csr/tickets, searches a user by
 * email, and confirms messages render with no error. READ-ONLY. Creds via env.
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'http://localhost:3004';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const SEARCH = process.env.CSR_SEARCH || 'testingreg061526d@idlookup.ai';

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);
  const net = [];
  page.on('response', (r) => { const u = r.url(); if (/contactMessage|database\/search|findNotes/i.test(u)) net.push({ status: r.status(), path: u.replace(/https?:\/\/[^/]+/, '').split('?')[0] }); });
  const rec = {};

  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);
  rec.pastLoginGate = !/\/login/.test(page.url());

  await page.goto(`${BASE}/csr/tickets`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // find the user-search input and search
  const searchBox = page.locator('input[type="search"], input[placeholder*="email" i], input[placeholder*="search" i], input[type="text"]').first();
  await searchBox.fill(SEARCH).catch(() => {});
  await searchBox.press('Enter').catch(() => {});
  await page.waitForTimeout(5000);

  const bodyText = await page.locator('body').innerText();
  rec.userMode = {
    failedToLoad: /failed to load contacts/i.test(bodyText),
    anyError: /failed to|forbidden|invalid database search role|error/i.test(bodyText),
    // list rows / message items present?
    rowish: await page.locator('li, [role="row"], [class*="item" i], [class*="thread" i], table tr').count(),
    showsSearchedEmail: bodyText.toLowerCase().includes((SEARCH.split('@')[0] || '').toLowerCase()),
  };
  rec.relevantResponses = net.slice(-12);

  console.log(JSON.stringify(rec, null, 2));
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
