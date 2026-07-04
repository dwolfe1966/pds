/* READ-ONLY form-validation probe. Tests ONLY invalid/blocked paths — never a successful
 * submit — so nothing reaches BC, no accounts created, no payment, no contact message sent.
 * For each form: attempt an invalid submit, capture whether navigation was blocked (= validation
 * fired) and any visible error text. Usage: node scripts/audit-consumer-forms.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://www.idlookup.ai';

async function probe(page, route, fills, submitRx) {
  const out = { route, urlBefore: '', urlAfter: '', blocked: null, errors: [], note: '' };
  try {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(800);
    out.urlBefore = page.url().replace(BASE, '');
    for (const f of fills) {
      const loc = page.locator(f.sel).first();
      if (await loc.count()) { try { f.type === 'select' ? await loc.selectOption({ index: f.index }) : await loc.fill(f.val); } catch {} }
    }
    const btn = page.getByRole('button', { name: submitRx }).first();
    if (!(await btn.count())) { out.note = 'submit button not found'; return out; }
    await btn.click({ timeout: 8000 }).catch((e) => { out.note = 'click: ' + e.message.slice(0, 60); });
    await page.waitForTimeout(1500);
    out.urlAfter = page.url().replace(BASE, '');
    out.blocked = out.urlBefore === out.urlAfter; // stayed on page = validation likely blocked it
    out.errors = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('[role="alert"],[class*="error" i],[class*="invalid" i],[aria-invalid="true"]'));
      const txt = els.map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim()).filter(Boolean);
      // also HTML5 validation messages
      const inv = Array.from(document.querySelectorAll('input,select,textarea')).map((e) => e.validationMessage).filter(Boolean);
      return [...new Set([...txt, ...inv])].slice(0, 6);
    });
  } catch (e) { out.note = 'ERR ' + String(e.message).slice(0, 80); }
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const tests = [];

  // signup: empty submit
  tests.push(await probe(page, '/signup', [], /create my account|sign ?up|create account/i));
  // signup: invalid email + short password
  tests.push(await probe(page, '/signup', [
    { sel: 'input[type="email"], input[placeholder*="example" i]', val: 'notanemail' },
    { sel: 'input[type="password"]', val: '123' },
  ], /create my account|sign ?up|create account/i));
  // login: empty
  tests.push(await probe(page, '/login', [], /log ?in|sign ?in/i));
  // forgot-password: empty
  tests.push(await probe(page, '/forgot-password', [], /reset|send|submit/i));
  // contact: empty
  tests.push(await probe(page, '/contact', [], /send|submit/i));
  // name search: empty submit (should block, not navigate to loader)
  tests.push(await probe(page, '/name/landing', [], /search/i));
  // phone search: invalid phone
  tests.push(await probe(page, '/phone/landing', [{ sel: 'input', val: 'abc' }], /search/i));
  // email search: invalid email
  tests.push(await probe(page, '/email/landing', [{ sel: 'input', val: 'notanemail' }], /search/i));

  console.log(JSON.stringify(tests, null, 2));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
