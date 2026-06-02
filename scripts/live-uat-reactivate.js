/* Authorized: restore test21 via re-purchase. Creds + test card via env.
 * Submits the payment to reactivate (also exercises #50 reactivation path). */
const { chromium, devices } = require('@playwright/test');
const BASE = 'https://dev.www.idlookup.ai';
const SHOTS = '/tmp/uat-shots';
const E = process.env.MEMBER_EMAIL, P = process.env.MEMBER_PWD;
const CARD = process.env.CARD, EXP = process.env.EXP, CVV = process.env.CVV || '123', ZIP = process.env.ZIP || '12345';
const out = []; const rec = (k, v) => out.push({ [k]: v });
const txt = (p) => p.locator('body').innerText();

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['Galaxy S5'] })).newPage();
  page.setDefaultTimeout(25000);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"]').first().fill(E);
  await page.locator('input[type="password"]').first().fill(P);
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(3500);

  // Account → Upgrade to Pro → /payment
  await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1000);
  await page.getByText(/subscription & billing|subscription/i).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /upgrade to pro|subscribe to pro|reactivate/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(3000);
  rec('reached_payment', { url: page.url().replace(BASE, '') });

  // Fill payment form
  const fill = async (sel, val) => { const l = page.locator(sel).first(); if (await l.count()) await l.fill(val).catch(() => {}); };
  await fill('input[name*="first" i], input[placeholder*="First" i]', 'Test');
  await fill('input[name*="last" i], input[placeholder*="Last" i]', 'User');
  await fill('input[name*="card" i], input[placeholder*="card" i], input[autocomplete="cc-number"]', CARD);
  await fill('input[name*="exp" i], input[placeholder*="MM" i], input[autocomplete="cc-exp"]', EXP);
  await fill('input[name*="cvv" i], input[name*="cvc" i], input[placeholder*="CVV" i], input[placeholder*="CVC" i], input[autocomplete="cc-csc"]', CVV);
  await fill('input[name*="zip" i], input[placeholder*="ZIP" i], input[autocomplete*="postal" i]', ZIP);
  // consent checkbox if present
  const cb = page.locator('input[type="checkbox"]').first();
  if (await cb.count()) await cb.check().catch(() => {});
  await page.screenshot({ path: `${SHOTS}/r01-payment-filled.png`, fullPage: true });

  // Submit
  await page.getByRole('button', { name: /agree|view report|start trial|unlock|subscribe|pay|submit|complete/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(7000);
  const t = await txt(page);
  await page.screenshot({ path: `${SHOTS}/r02-after-submit.png`, fullPage: true });
  rec('submit_result_50', { url: page.url().replace(BASE, ''),
    captcha: /input password/i.test(t),
    error: /error|nonmemberonly|declined|failed|expired/i.test(t),
    success: /you're (in|all set)|welcome|confirmation|active subscription|thank/i.test(t),
    sample: t.replace(/\s+/g, ' ').slice(0, 240) });

  // Verify account active again
  await page.goto(`${BASE}/account`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  await page.getByText(/subscription & billing|subscription/i).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  const ta = await txt(page);
  await page.screenshot({ path: `${SHOTS}/r03-account-restored.png`, fullPage: true });
  rec('account_after', { active: /\bactive\b/i.test(ta) && !/do not have an active/i.test(ta),
    noActiveSub: /do not have an active/i.test(ta), sample: ta.replace(/\s+/g, ' ').slice(0, 200) });

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
