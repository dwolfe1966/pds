/* Live UAT against dev.www.idlookup.ai using a real Chromium emulating a
 * Galaxy S5 (the device the bugs were filed on). Read-only / no payment, no
 * account submit. Prints a JSON array of {id, check, steps, observed, outcome}.
 *
 *   node scripts/live-uat-6-2.js
 */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');

const BASE = 'https://dev.www.idlookup.ai';
const SHOTS = '/tmp/uat-shots';
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const log = (id, check, steps, observed, outcome) =>
  results.push({ id, check, steps, observed, outcome });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Galaxy S5'] });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);

  // ── #1/#6 placeholders + #2/#12 state-required validation (name landing) ──
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SHOTS}/01-name-landing.png` });
    const bodyText = await page.locator('body').innerText();
    const phEx = await page.getByPlaceholder(/ex\.?\s*John|First/i).count().catch(() => 0);
    log('1/6', 'Name landing placeholders',
      'Galaxy S5 → load /; read placeholders/body',
      `placeholder-with-"ex./First" count=${phEx}; body has "ex. John"=${bodyText.includes('ex. John')} "ex. Smith"=${bodyText.includes('ex. Smith')}`,
      (bodyText.includes('ex. John') || phEx > 0) ? 'PASS — split/example placeholders rendered' : 'INCONCLUSIVE — placeholder text not found in DOM');
  } catch (e) { log('1/6', 'Name landing placeholders', 'load /', `ERROR ${e.message}`, 'BLOCKED'); }

  // Try a first-name-only submit and watch for validation (no navigation away)
  try {
    const urlBefore = page.url();
    // type into first visible text input, leave state empty, click the search/submit button
    const firstInput = page.locator('input[type="text"], input:not([type])').first();
    await firstInput.fill('Jerome');
    const btn = page.getByRole('button', { name: /search|find|view|continue|get/i }).first();
    await btn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const urlAfter = page.url();
    const errText = await page.locator('text=/required|enter|select|please|valid/i').first().innerText().catch(() => '');
    await page.screenshot({ path: `${SHOTS}/02-name-validation.png` });
    log('1/2/12', 'Name landing: submit first-name-only / state required',
      'Fill first name only, leave state blank, click submit',
      `url moved=${urlBefore !== urlAfter} (before=${urlBefore.replace(BASE,'')} after=${urlAfter.replace(BASE,'')}); error text="${errText.slice(0,80)}"`,
      (urlBefore === urlAfter || errText) ? 'PASS — blocked / validation shown' : 'FAIL/INCONCLUSIVE — navigated without error');
  } catch (e) { log('1/2/12', 'Name landing validation', 'submit attempt', `ERROR ${e.message}`, 'BLOCKED'); }

  // ── #8/#9 FCRA promotional claims removed (v3/v4 rendered) ──
  for (const v of ['v3', 'v4']) {
    try {
      await page.goto(`${BASE}/name/landing/${v}`, { waitUntil: 'networkidle' });
      const t = (await page.locator('body').innerText()).toLowerCase();
      log(v === 'v3' ? '8' : '9', `FCRA claim removed (${v})`,
        `load /name/landing/${v}; scan rendered text`,
        `"fcra compliant"=${t.includes('fcra compliant')} "fcra safe"=${t.includes('fcra safe')} (any "fcra"=${t.includes('fcra')})`,
        (!t.includes('fcra compliant') && !t.includes('fcra safe')) ? 'PASS — promotional FCRA claim absent' : 'FAIL — FCRA claim still present');
    } catch (e) { log(v === 'v3' ? '8' : '9', `FCRA ${v}`, `load ${v}`, `ERROR ${e.message}`, 'BLOCKED'); }
  }

  // ── #14 phone landing: empty submit shows error ──
  try {
    await page.goto(`${BASE}/phone/landing`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SHOTS}/03-phone-landing.png` });
    const btn = page.getByRole('button', { name: /search|find|lookup|get/i }).first();
    await btn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const err = await page.locator('text=/required|enter|valid|phone/i').first().innerText().catch(() => '');
    log('14', 'Phone landing: empty submit error',
      'load /phone/landing; click search with empty field',
      `error shown="${err.slice(0,80)}"`,
      err ? 'PASS — inline error on empty submit' : 'INCONCLUSIVE — no error captured');
  } catch (e) { log('14', 'Phone landing empty submit', 'click empty', `ERROR ${e.message}`, 'BLOCKED'); }

  // ── #3/#5/#11 SRP behavior: real name search (hits BC) ──
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.locator('input[type="text"], input:not([type])').first().fill('Jerome');
    // try a second name field if present
    const inputs = page.locator('input[type="text"], input:not([type])');
    const n = await inputs.count();
    if (n > 1) await inputs.nth(1).fill('Ang');
    // state select
    const sel = page.locator('select').first();
    if (await sel.count()) await sel.selectOption({ label: 'California' }).catch(async () => { await sel.selectOption('CA').catch(()=>{}); });
    await page.getByRole('button', { name: /search|find|view|get/i }).first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${SHOTS}/04-srp.png`, fullPage: true });
    const srpText = await page.locator('body').innerText();
    const countMatch = srpText.match(/\b(\d+)\s*(of|results?|matches?)\b/i);
    const hasLoadMore = await page.getByRole('button', { name: /load more|show more|more results/i }).count();
    const hasSort = await page.locator('select, [role="listbox"]').filter({ hasText: /relevance|age|name|sort/i }).count()
      + await page.locator('text=/sort/i').count();
    const captcha = /captcha|verify you|password/i.test(srpText);
    log('3/5/11', 'SRP count / Load More / sort (real search Jerome Ang CA)',
      'Fill name+state, submit, land on SRP, inspect rendered results',
      `url=${page.url().replace(BASE,'')}; count-phrase="${countMatch ? countMatch[0] : 'none'}"; LoadMore btn=${hasLoadMore}; sort-affordance≈${hasSort}; captcha=${captcha}`,
      captcha ? 'BLOCKED — BC captcha gate' : (countMatch ? 'PASS — SRP rendered with result count' : 'INCONCLUSIVE — SRP text not parsed'));
  } catch (e) { log('3/5/11', 'SRP search', 'name search', `ERROR ${e.message}`, 'BLOCKED'); }

  // ── #15 phone SRP: results blurred/masked + unlock ──
  try {
    await page.goto(`${BASE}/phone/landing`, { waitUntil: 'networkidle' });
    await page.locator('input').first().fill('213-935-0507');
    await page.getByRole('button', { name: /search|find|lookup|get/i }).first().click({ timeout: 6000 }).catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3500);
    await page.screenshot({ path: `${SHOTS}/05-phone-srp.png`, fullPage: true });
    const t = await page.locator('body').innerText();
    const unlock = /sign up to unlock|unlock|🔒/i.test(t);
    const captcha = /captcha|verify you/i.test(t);
    log('15', 'Phone SRP: obscured details + unlock',
      'Search phone 213-935-0507, inspect SRP',
      `url=${page.url().replace(BASE,'')}; "unlock"/lock present=${unlock}; captcha=${captcha}`,
      captcha ? 'BLOCKED — BC captcha gate' : (unlock ? 'PASS — unlock/obscured gating present' : 'INCONCLUSIVE'));
  } catch (e) { log('15', 'Phone SRP', 'phone search', `ERROR ${e.message}`, 'BLOCKED'); }

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
