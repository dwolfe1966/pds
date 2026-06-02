/* Authenticated member STATEFUL flow — creds via env. Read-mostly; performs an
 * authorized cancel + reactivate on test21 and leaves it ACTIVE.
 *  A. member search "John Smith CA"   (#43, #69)
 *  B. cancel via "Yes, Cancel"        (#72 lightbox)
 *  C. post-cancel: reports (#56), search access (#59), account (#49), reactivate btn (#57)
 *  D. reactivate -> restore active    (#57)
 */
const { chromium, devices } = require('@playwright/test');
const BASE = 'https://dev.www.idlookup.ai';
const SHOTS = '/tmp/uat-shots';
const EMAIL = process.env.MEMBER_EMAIL, PWD = process.env.MEMBER_PWD;
const out = []; const rec = (k, v) => out.push({ [k]: v });
const txt = (p) => p.locator('body').innerText();
const billing = async (p) => { await p.goto(`${BASE}/account`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000); await p.getByText(/subscription & billing|subscription/i).first().click().catch(()=>{}); await p.waitForTimeout(1800); };

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['Galaxy S5'] })).newPage();
  page.setDefaultTimeout(20000);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[name*="email" i]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PWD);
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(3500);

  // A) member search John Smith CA
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
    const ins = page.locator('input[type="text"], input:not([type])');
    await ins.nth(0).fill('John'); await ins.nth(1).fill('Smith');
    const st = page.locator('input[maxlength="2"]').first();
    if (await st.count()) await st.fill('CA');
    // robust submit: click any Search button, else Enter
    const btn = page.locator('button:has-text("Search"), button[type="submit"]').first();
    if (await btn.count()) await btn.click().catch(()=>{}); else await st.press('Enter').catch(()=>{});
    await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(6000);
    const t = await txt(page);
    await page.screenshot({ path: `${SHOTS}/g01-john-smith.png`, fullPage: true });
    rec('search_43_69', { url: page.url().replace(BASE, ''), captcha: /input password|captcha/i.test(t),
      noResults: /no results|not found|no records|too many/i.test(t),
      countPhrase: (t.match(/\b\d+\s*(of|results?|matches?)\b/i) || [null])[0],
      loadMore: /load more|show more/i.test(t), sample: t.replace(/\s+/g,' ').slice(0,160) });
  } catch (e) { rec('search_43_69', { error: e.message }); }

  // B) cancel
  try {
    await billing(page);
    await page.getByRole('button', { name: /cancel subscription/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const tl = await txt(page);
    rec('cancel_lightbox_72', { lightboxShown: /keep subscription|yes,? cancel|are you sure/i.test(tl) });
    await page.getByRole('button', { name: 'Yes, Cancel' }).click({ timeout: 6000 }).catch(async () => {
      await page.getByRole('button', { name: /yes,? cancel/i }).first().click().catch(()=>{});
    });
    await page.waitForTimeout(4000);
    await billing(page);
    const t2 = await txt(page);
    await page.screenshot({ path: `${SHOTS}/g02-after-cancel.png`, fullPage: true });
    rec('after_cancel', { status: (t2.match(/canceling|canceled|cancelled|active|expired/i)||[null])[0],
      reactivateBtn_57: /reactivate/i.test(t2), accessUntil: /access until|active until|until \d|remain active/i.test(t2),
      reportsInAccount_49: /view report|your reports/i.test(t2), sample: t2.replace(/\s+/g,' ').slice(0,200) });
  } catch (e) { rec('after_cancel', { error: e.message }); }

  // C) post-cancel dashboard: reports (#56) + search access (#59)
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2000);
    const t = await txt(page);
    await page.screenshot({ path: `${SHOTS}/g03-dash-postcancel.png`, fullPage: true });
    rec('post_cancel_56_59', { reportsStillShown_56: /your reports|view report|in your library/i.test(t),
      searchBoxPresent_59: await page.locator('input[placeholder*="First" i]').count() > 0,
      searchBlockedMsg: /reactivate to|subscribe to search|upgrade to search|no longer/i.test(t) });
  } catch (e) { rec('post_cancel_56_59', { error: e.message }); }

  // D) reactivate -> restore active (#57)
  try {
    await billing(page);
    await page.getByRole('button', { name: /reactivate/i }).first().click().catch(() => {});
    await page.waitForTimeout(4000);
    await billing(page);
    const t = await txt(page);
    await page.screenshot({ path: `${SHOTS}/g04-after-reactivate.png`, fullPage: true });
    rec('reactivate_57_50', { status: (t.match(/canceling|canceled|cancelled|active|expired/i)||[null])[0],
      reactivateGone: !/reactivate/i.test(t), errorShown: /error|nonmemberonly|failed/i.test(t),
      sample: t.replace(/\s+/g,' ').slice(0,200) });
  } catch (e) { rec('reactivate_57_50', { error: e.message }); }

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
