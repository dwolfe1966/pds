/* Authenticated member UAT against dev.www.idlookup.ai, Galaxy S5.
 * Credentials from env (MEMBER_EMAIL / MEMBER_PWD) — never hardcoded/committed.
 * READ-ONLY: logs in, inspects dashboard/search/report/account. Does NOT cancel,
 * pay, change account settings, or sign up.
 *
 *   MEMBER_EMAIL=... MEMBER_PWD=... node scripts/live-uat-member.js
 */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const BASE = 'https://dev.www.idlookup.ai';
const SHOTS = '/tmp/uat-shots';
fs.mkdirSync(SHOTS, { recursive: true });
const EMAIL = process.env.MEMBER_EMAIL, PWD = process.env.MEMBER_PWD;
const out = [];
const rec = (k, v) => { out.push({ [k]: v }); };

(async () => {
  if (!EMAIL || !PWD) { console.error('missing creds'); process.exit(1); }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Galaxy S5'] });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  // ── LOGIN ──
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${SHOTS}/m01-login.png` });
  // fill email + password
  const email = page.locator('input[type="email"], input[name*="email" i], input[placeholder*="email" i]').first();
  const pwd = page.locator('input[type="password"]').first();
  await email.fill(EMAIL);
  await pwd.fill(PWD);
  await page.getByRole('button', { name: /log ?in|sign ?in|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);
  const urlAfter = page.url().replace(BASE, '');
  const body = await page.locator('body').innerText().catch(() => '');
  const captcha = /input password|captcha|verify you/i.test(body);
  await page.screenshot({ path: `${SHOTS}/m02-after-login.png`, fullPage: true });
  rec('login', { url: urlAfter, captcha, loggedIn: !/log ?in|sign ?in/i.test(urlAfter) && urlAfter !== '/login',
    mentionsFree: /free account|upgrade to pro/i.test(body), mentionsSubscriber: /subscriber|pro member|active|premium/i.test(body),
    bodySample: body.replace(/\s+/g, ' ').slice(0, 200) });

  // ── #67 member header logo ──
  const himgs = await page.locator('header img, nav img, a img').evaluateAll(els =>
    els.map(e => ({ broken: e.complete && e.naturalWidth === 0, w: e.naturalWidth })));
  rec('member_header_logo_67', { imgs: himgs, anyBroken: himgs.some(i => i.broken) });

  // ── #79 dashboard search location field type ──
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const selects = await page.locator('select').count();
    const stateInputs = await page.locator('input[maxlength="2"], input[placeholder*="state" i]').count();
    rec('dashboard_location_79', { selectDropdowns: selects, textStateInputs: stateInputs });
    await page.screenshot({ path: `${SHOTS}/m03-dashboard.png`, fullPage: true });
  } catch (e) { rec('dashboard_location_79', { error: e.message }); }

  // ── member name search (#43 John Smith CA, #69 count) ──
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const inputs = page.locator('input[type="text"], input:not([type])');
    if (await inputs.count() >= 2) {
      await inputs.nth(0).fill('John'); await inputs.nth(1).fill('Smith');
      const sel = page.locator('select').first();
      if (await sel.count()) await sel.selectOption('CA').catch(() => {});
      await page.getByRole('button', { name: /search/i }).first().click().catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(4000);
      const t = await page.locator('body').innerText();
      const cap = /input password|captcha/i.test(t);
      const countM = t.match(/\b(\d+)\s*(of|results?)\b/i);
      const noRes = /no results|not found|no records/i.test(t);
      await page.screenshot({ path: `${SHOTS}/m04-member-srp.png`, fullPage: true });
      rec('member_search_43_69', { url: page.url().replace(BASE, ''), captcha: cap, count: countM ? countM[0] : null, noResults: noRes });
    } else rec('member_search_43_69', { note: 'search inputs not found on dashboard' });
  } catch (e) { rec('member_search_43_69', { error: e.message }); }

  // ── account / billing page (#46 settings position, #47 upgrade copy, #58 billing $1) ──
  try {
    await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const t = await page.locator('body').innerText();
    await page.screenshot({ path: `${SHOTS}/m05-account.png`, fullPage: true });
    rec('account_46_47_58', {
      url: page.url().replace(BASE, ''),
      hasUpgradeWith2999: /\$29\.99/.test(t),
      mentionsTrialOrDollar: /\$1|trial/i.test(t),
      hasBillingHistory: /billing history|invoice|receipt/i.test(t),
      reactivateOrCancel: /reactivate|cancel/i.test(t),
      sample: t.replace(/\s+/g, ' ').slice(0, 220),
    });
  } catch (e) { rec('account_46_47_58', { error: e.message }); }

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
