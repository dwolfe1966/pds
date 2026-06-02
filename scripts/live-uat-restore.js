/* Complete #43/#69 search + investigate reactivation path. Creds via env.
 * Does NOT submit any payment. */
const { chromium, devices } = require('@playwright/test');
const BASE = 'https://dev.www.idlookup.ai';
const SHOTS = '/tmp/uat-shots';
const EMAIL = process.env.MEMBER_EMAIL, PWD = process.env.MEMBER_PWD;
const out = []; const rec = (k, v) => out.push({ [k]: v });
const txt = (p) => p.locator('body').innerText();

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['Galaxy S5'] })).newPage();
  page.setDefaultTimeout(20000);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PWD);
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(3500);

  // #43/#69 — run the actual search on /people-search
  try {
    await page.goto(`${BASE}/people-search?firstName=John&lastName=Smith&state=CA`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /search records|^search/i }).first().click().catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(6000);
    const t = await txt(page);
    await page.screenshot({ path: `${SHOTS}/h01-johnsmith-results.png`, fullPage: true });
    rec('search_43_69', { url: page.url().replace(BASE, ''), captcha: /input password|captcha/i.test(t),
      noResults: /no results|not found|no records|couldn|too many/i.test(t),
      countPhrase: (t.match(/\b\d+\s*(of|results?|matches?)\b/i) || [null])[0],
      sample: t.replace(/\s+/g, ' ').slice(0, 220) });
  } catch (e) { rec('search_43_69', { error: e.message }); }

  // current subscription state + reactivation path (NO payment submit)
  try {
    await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
    await page.getByText(/subscription & billing|subscription/i).first().click().catch(() => {});
    await page.waitForTimeout(1800);
    const t0 = await txt(page);
    rec('account_state', { noActiveSub: /do not have an active|no active subscription/i.test(t0),
      hasReactivate: /reactivate/i.test(t0), hasUpgradeToPro: /upgrade to pro|subscribe to pro/i.test(t0) });
    // click Upgrade to Pro / Reactivate and see where it lands (do NOT submit)
    const cta = page.getByRole('button', { name: /reactivate|upgrade to pro|subscribe to pro/i }).first()
      .or(page.getByRole('link', { name: /reactivate|upgrade to pro|subscribe to pro/i }).first());
    await cta.click({ timeout: 6000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(3000);
    const t1 = await txt(page);
    const cardFields = await page.locator('input[autocomplete*="cc"], input[name*="card" i], input[placeholder*="card" i], input[name*="cvv" i], input[placeholder*="CVC" i], input[placeholder*="MM" i]').count();
    await page.screenshot({ path: `${SHOTS}/h02-reactivate-landing.png`, fullPage: true });
    rec('reactivate_path_57_50', { url: page.url().replace(BASE, ''),
      landsOnPaymentForm: cardFields > 0, cardFieldCount: cardFields,
      errorShown: /error|nonmemberonly|failed|already/i.test(t1),
      reactivatedDirectly: /you're (in|all set)|now active|subscription active|active subscription/i.test(t1),
      sample: t1.replace(/\s+/g, ' ').slice(0, 220) });
  } catch (e) { rec('reactivate_path_57_50', { error: e.message }); }

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
