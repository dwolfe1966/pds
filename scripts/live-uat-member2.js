/* Authenticated member UAT v2 — read-only. Opens an existing library report
 * (no new search → no captcha), inspects report page, PDF affordance, billing
 * tab, and the dashboard search-form field types. Creds from env. */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const BASE = 'https://dev.www.idlookup.ai';
const SHOTS = '/tmp/uat-shots';
const EMAIL = process.env.MEMBER_EMAIL, PWD = process.env.MEMBER_PWD;
const out = []; const rec = (k, v) => out.push({ [k]: v });

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['Galaxy S5'] })).newPage();
  page.setDefaultTimeout(20000);
  // login
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[name*="email" i]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PWD);
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3500);

  // #79 — dashboard search form field types (precise)
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const formFields = await page.locator('form input, form select, input, select').evaluateAll(els =>
    els.slice(0, 12).map(e => ({ tag: e.tagName, type: e.type || '', ph: e.placeholder || '', ml: e.maxLength })));
  rec('dashboard_search_fields_79', formFields);

  // #71 / #39 / #41 / #44 — open the first existing report from "Your Reports"
  try {
    // report links usually go to /people/:id or /report/:id or have "View" text
    const reportLink = page.locator('a[href*="/people/"], a[href*="/report"], a:has-text("View")').first();
    const href = await reportLink.getAttribute('href').catch(() => null);
    await reportLink.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(4000);
    const url = page.url().replace(BASE, '');
    const t = await page.locator('body').innerText();
    const interstitial = /report is ready|preparing your report|your report is ready/i.test(t);
    const captcha = /input password|captcha/i.test(t);
    // section presence (report depth #39/#41)
    const sections = ['overview', 'contact', 'phone', 'email', 'address', 'relatives', 'associates',
      'criminal', 'court', 'financial', 'property', 'license', 'social', 'employment', 'education']
      .filter(s => new RegExp(s, 'i').test(t));
    const pdf = await page.getByRole('button', { name: /pdf|download/i }).count()
      + await page.locator('a:has-text("PDF"), button:has-text("PDF")').count();
    await page.screenshot({ path: `${SHOTS}/m06-report.png`, fullPage: true });
    rec('report_71_39_41_44', { clickedHref: href, url, interstitial, captcha, sectionsFound: sections, pdfAffordance: pdf, bodyLen: t.length });
  } catch (e) { rec('report_71_39_41_44', { error: e.message }); }

  // #47 / #58 / #49 — Subscription & Billing tab
  try {
    await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.getByText(/subscription & billing|subscription|billing/i).first().click().catch(() => {});
    await page.waitForTimeout(2500);
    const t = await page.locator('body').innerText();
    await page.screenshot({ path: `${SHOTS}/m07-billing.png`, fullPage: true });
    rec('billing_47_58_49', {
      has2999: /\$29\.99/.test(t),
      hasDollar1OrTrial: /\$1\b|\$1\.00|trial/i.test(t),
      billingHistoryRows: (t.match(/\$\d+\.\d{2}/g) || []).slice(0, 8),
      status: /active|canceled|cancelled|trial|expired/i.test(t) ? (t.match(/active|canceled|cancelled|trial|expired/i) || [])[0] : null,
      reactivate: /reactivate/i.test(t), cancelOption: /cancel subscription|cancel/i.test(t),
      sample: t.replace(/\s+/g, ' ').slice(0, 240),
    });
  } catch (e) { rec('billing_47_58_49', { error: e.message }); }

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
