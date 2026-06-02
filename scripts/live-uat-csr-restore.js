/* CSR: look up test21, inspect order state, verify Notes & Messages tab, and
 * attempt to un-cancel the order to restore test21. Creds via env. */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const SHOTS = '/tmp/uat-shots';
const U = process.env.CSR_USER, P = process.env.CSR_PWD, TARGET = process.env.TARGET || 'test21@test21.com';
const out = []; const rec = (k, v) => out.push({ [k]: v });
const txt = (p) => p.locator('body').innerText();

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  await page.locator('input[type="email"], input[name*="email" i], input[name*="user" i]').first().fill(U);
  await page.locator('input[type="password"]').first().fill(P);
  await page.getByRole('button', { name: /log ?in|sign ?in|submit/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(4000);

  // search test21
  await page.goto(`${BASE}/csr/users`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2000);
  const sb = page.locator('input[type="search"], input[placeholder*="email" i], input[placeholder*="search" i], input[type="text"]').first();
  await sb.fill(TARGET); await sb.press('Enter').catch(() => {});
  await page.waitForTimeout(4000);
  // open the matching user
  const link = page.locator(`a[href*="/users/"]`).first();
  await link.click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(3500);
  const td = await txt(page);
  await page.screenshot({ path: `${SHOTS}/cr01-test21-detail.png`, fullPage: true });
  rec('test21_detail', { url: page.url().replace(BASE, ''),
    matchesTarget: td.toLowerCase().includes(TARGET.toLowerCase()),
    orderStatus: (td.match(/active|canceled|cancelled|expired|failed|fulfilled/i) || [null])[0],
    sample: td.replace(/\s+/g, ' ').slice(0, 220) });

  // Notes & Messages TAB (precise: the tab, not the top nav)
  try {
    const tab = page.getByRole('tab', { name: /notes\s*&\s*messages/i })
      .or(page.locator('button, [role="tab"], a').filter({ hasText: /^Notes\s*&\s*Messages$/i })).first();
    await tab.click({ timeout: 6000 }).catch(async () => { await page.getByText(/notes\s*&\s*messages/i).last().click().catch(() => {}); });
    await page.waitForTimeout(3000);
    const tn = await txt(page);
    await page.screenshot({ path: `${SHOTS}/cr02-notes-messages.png`, fullPage: true });
    rec('notes_messages_tab', {
      notesHeading: /notes/i.test(tn), messagesHeading: /messages|tickets|contact/i.test(tn),
      addNoteControl: /add note|new note|write a note/i.test(tn),
      sample: tn.replace(/\s+/g, ' ').slice(0, 240) });
  } catch (e) { rec('notes_messages_tab', { error: e.message }); }

  // Orders tab → look for cancel/uncancel action to restore test21
  try {
    await page.getByRole('tab', { name: /orders|payments/i }).or(page.getByText(/orders\s*&\s*payments/i)).first().click().catch(() => {});
    await page.waitForTimeout(2500);
    const to = await txt(page);
    await page.screenshot({ path: `${SHOTS}/cr03-orders.png`, fullPage: true });
    const uncancel = page.getByRole('button', { name: /uncancel|un-cancel|reactivate|reinstate|resume/i }).first();
    const hasUncancel = await uncancel.count();
    rec('orders_tab', { orderText: to.replace(/\s+/g, ' ').slice(0, 200), hasUncancelAction: hasUncancel });
    if (hasUncancel) {
      await uncancel.click().catch(() => {});
      await page.waitForTimeout(3500);
      const tr = await txt(page);
      await page.screenshot({ path: `${SHOTS}/cr04-after-uncancel.png`, fullPage: true });
      rec('uncancel_result', { sample: tr.replace(/\s+/g, ' ').slice(0, 200) });
    }
  } catch (e) { rec('orders_tab', { error: e.message }); }

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
