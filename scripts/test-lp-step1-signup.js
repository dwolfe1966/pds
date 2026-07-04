/* Render/structure tests for the LP step-1 screens (/name/landing/v2..v6) + the signup
 * profile-teaser page (SearchDetailPreviewVariantA). Runs against a local prod build
 * (serve-prod on :3000) — no captcha needed for step-1; the teaser is seeded via
 * sessionStorage. Asserts key elements render + captures console/page errors + a screenshot
 * per page. Screenshots → /tmp (not committed). Usage: node scripts/test-lp-step1-signup.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'http://localhost:3000';

const results = [];
function record(name, checks, errs) {
  const failed = checks.filter((c) => !c.pass);
  results.push({ name, ok: failed.length === 0 && errs.length === 0, checks, errs });
}

async function testStep1(browser, v) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR: ' + String(e.message).slice(0, 140)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 120)); });
  await page.goto(`${BASE}/name/landing/${v}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  const inputs = await page.locator('input[type="text"], input:not([type])').count();
  const buttons = await page.locator('button').count();
  const heading = (await page.locator('h1, h2').first().textContent().catch(() => '')) || '';
  const bodyText = (await page.locator('body').textContent().catch(() => '')) || '';
  record(`step1 /name/landing/${v}`, [
    { label: '≥2 name inputs', pass: inputs >= 2, got: inputs },
    { label: 'has a button (CTA)', pass: buttons >= 1, got: buttons },
    { label: 'non-empty heading', pass: heading.trim().length > 0, got: heading.trim().slice(0, 40) },
    { label: 'shows a trust signal (Records/Secure)', pass: /Records|Secure|Encrypted|🔒/i.test(bodyText) },
  ], errs);
  await page.screenshot({ path: `/tmp/test-step1-${v}.png`, fullPage: true }).catch(() => {});
  await ctx.close();
}

async function testTeaser(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR: ' + String(e.message).slice(0, 140)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 120)); });
  // Seed a FAKE person (no real PII) before page scripts run.
  const person = { id: 'TEST', fullName: 'Jordan Tester', name: 'Jordan Tester',
    ageRange: '45-49', location: 'Austin, TX', _phoneCount: '2–4 found',
    _emailCount: '1–3 found', _addressCount: '3–7 found' };
  await ctx.addInitScript((p) => {
    try { sessionStorage.setItem('result_TEST', JSON.stringify(p)); } catch (e) {}
  }, person);
  await page.goto(`${BASE}/search/TEST?v=a`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  const bodyText = (await page.locator('body').textContent().catch(() => '')) || '';
  const emailInput = await page.locator('input[type="email"], input[name*="email" i], #va-email').count();
  const pwInput = await page.locator('input[type="password"]').count();
  record('signup teaser (VariantA)', [
    { label: 'shows person name', pass: /Jordan Tester/.test(bodyText) },
    { label: 'shows gated counts (found)', pass: /found/i.test(bodyText) },
    { label: 'has email input', pass: emailInput >= 1, got: emailInput },
    { label: 'has password input', pass: pwInput >= 1, got: pwInput },
    { label: 'has Unlock/Create CTA', pass: /Unlock|Create Account|Sign Up|See Results/i.test(bodyText) },
    { label: 'shows trust (SSL/Encrypted)', pass: /SSL|Encrypted|🔒/i.test(bodyText) },
  ], errs);
  await page.screenshot({ path: `/tmp/test-signup-teaser.png`, fullPage: true }).catch(() => {});
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  for (const v of ['v2', 'v3', 'v4', 'v5', 'v6']) await testStep1(browser, v);
  await testTeaser(browser);
  await browser.close();

  console.log('\n=== LP step-1 + signup-teaser tests (' + BASE + ') ===');
  let pass = 0;
  for (const r of results) {
    console.log(`\n${r.ok ? '✅' : '❌'} ${r.name}`);
    r.checks.forEach((c) => console.log(`   ${c.pass ? '✓' : '✗'} ${c.label}${c.got !== undefined ? ` (${c.got})` : ''}`));
    r.errs.forEach((e) => console.log(`   ⚠️ ${e}`));
    if (r.ok) pass++;
  }
  console.log(`\n${pass}/${results.length} pages passed. Screenshots → /tmp/test-step1-*.png, /tmp/test-signup-teaser.png`);
})();
