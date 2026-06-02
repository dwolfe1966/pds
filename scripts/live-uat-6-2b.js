/* Refinement pass: precise placeholder values, precise phone-empty validation,
 * and capture the BC captcha gate as evidence. */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const BASE = 'https://dev.www.idlookup.ai';
const SHOTS = '/tmp/uat-shots';
const out = [];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Galaxy S5'] });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  // Actual placeholder values on name landing
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const phs = await page.locator('input').evaluateAll(els =>
    els.map(e => ({ ph: e.placeholder || '', type: e.type, name: e.name || '' })).filter(x => x.ph));
  out.push({ id: '1/6', placeholders: phs });

  // Phone landing empty-submit: precise — URL stays + aria-invalid / error node
  await page.goto(`${BASE}/phone/landing`, { waitUntil: 'networkidle' });
  const urlB = page.url();
  await page.getByRole('button', { name: /search|find|lookup|get/i }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const urlA = page.url();
  const invalids = await page.locator('[aria-invalid="true"]').count();
  const errNodes = await page.locator('[class*="error" i], [role="alert"]').allInnerTexts().catch(() => []);
  out.push({ id: '14', urlStayed: urlB === urlA, ariaInvalid: invalids, errorNodes: errNodes.filter(Boolean).slice(0, 3) });

  // Capture the BC captcha gate on a name search (evidence for the search-flow block)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const inputs = page.locator('input[type="text"], input:not([type])');
  await inputs.first().fill('Jerome');
  if (await inputs.count() > 1) await inputs.nth(1).fill('Ang');
  const sel = page.locator('select').first();
  if (await sel.count()) await sel.selectOption('CA').catch(() => {});
  await page.getByRole('button', { name: /search|find|view|get/i }).first().click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${SHOTS}/06-captcha-gate.png`, fullPage: true });
  const body = (await page.locator('body').innerText()).toLowerCase();
  out.push({
    id: '3/5/11-captcha',
    url: page.url().replace(BASE, ''),
    captchaWords: ['captcha', 'verify you', 'i am not a robot', 'password', 'security check'].filter(w => body.includes(w)),
    bodySample: body.replace(/\s+/g, ' ').slice(0, 240),
  });

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
