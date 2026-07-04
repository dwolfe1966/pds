/* SAFE prod probe for the Contact Us 412 (topic="Privacy" case).
 * The "Privacy" submission FAILS (412), so it writes NOTHING to prod — only "Other" creates data.
 * Captures the exact /contactMessage/create request payload + response status + body so we can
 * see BC's precondition. Headless. Usage: node scripts/probe-contact-412.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://www.idlookup.ai';
const REASON = process.env.REASON || 'Privacy';
const EMAIL = process.env.TEST_EMAIL || `qa.contact.${Math.floor(Date.now() / 1000)}@example.com`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const hits = [];
  page.on('request', (r) => {
    if (/contactMessage\/create/i.test(r.url())) hits.push({ phase: 'request', url: r.url(), body: r.postData() });
  });
  page.on('response', async (r) => {
    if (/contactMessage\/create/i.test(r.url())) {
      let body = null;
      try { body = await r.text(); } catch {}
      hits.push({ phase: 'response', status: r.status(), url: r.url(), body });
    }
  });

  try {
    console.log(`\n== Probing ${BASE}/contact  reason="${REASON}"  email=${EMAIL} ==\n`);
    await page.goto(`${BASE}/contact`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.getByText('Start an Email', { exact: false }).first().click({ timeout: 10000 });
    await page.waitForSelector('#email-reason', { timeout: 10000 });
    await page.selectOption('#email-reason', { label: REASON }).catch(async () => {
      await page.selectOption('#email-reason', REASON).catch(() => {});
    });
    await page.fill('#email-name', 'QA Probe');
    await page.fill('#email-email', EMAIL);
    await page.fill('#email-description', 'Automated diagnostic probe for the 412 issue. Please ignore.');
    // phone left blank on purpose — app injects its 2125550100 sentinel.
    await page.getByRole('button', { name: /send|submit/i }).first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(6000);
  } catch (e) {
    console.log('PROBE ERROR:', e.message);
  }

  console.log('=== captured /contactMessage/create traffic ===');
  for (const h of hits) {
    if (h.phase === 'request') console.log(`\n[REQUEST] ${h.url}\n  body: ${h.body}`);
    else console.log(`\n[RESPONSE ${h.status}] ${h.url}\n  body: ${h.body}`);
  }
  if (!hits.length) console.log('(no contactMessage/create call captured — form may have validated client-side or selector missed)');
  await browser.close();
})();
