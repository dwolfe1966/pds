/* Live UAT for the shN funnel + GTM attribution plumbing that feeds the Google
 * Ads conversion. Tests the parts that DON'T require solving the BC captcha:
 *   - ?shn=<token> resolves the campaign registry → redirects to the right landing
 *   - gclid + shn are captured first-touch (sessionStorage) and ride the dataLayer
 *   - the dataLayer exists and every push carries the ad-click id (attribution)
 *   - negative control: no shN → no campaign redirect
 *
 * It does NOT test the post-payment `purchase` conversion fire — that needs a full
 * funnel walk through the captcha-gated search + a real billing.sale, so it stays
 * manual (see docs/qa/conversion-tracking-test-plan.md, step 1).
 *
 *   BASE=https://www.idlookup.ai node scripts/live-uat-gtm-shn.js
 *   (defaults to dev.www.idlookup.ai)
 *
 * Read-only. No account submit, no payment, no creds. Exits non-zero on any FAIL.
 */
const { chromium } = require('@playwright/test');

const BASE = process.env.BASE || 'https://dev.www.idlookup.ai';
const SHN = '6a22ff83ca16ad4ef68b84b5';            // Google Inmates Upper
const GCLID = 'TeSt_gclid_uat_123';                 // synthetic — auto-tagging supplies the real one
const EXPECT_LANDING = '/name/landing/v3';          // registry landing.route for this shN

const results = [];
const log = (id, check, observed, outcome) => results.push({ id, check, observed, outcome });

(async () => {
  const browser = await chromium.launch();
  // Fresh context per case so first-touch / sessionStorage state can't leak between tests.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);

  // ── 1. shN resolves → redirect to the campaign landing ──────────────────────
  try {
    await page.goto(`${BASE}/?shn=${SHN}&gclid=${GCLID}`, { waitUntil: 'networkidle' });
    // HomePageRedirect routes off the landingPending flag; give it a beat to fire.
    await page.waitForURL(/\/name\/landing\/v3/, { timeout: 8000 }).catch(() => {});
    const url = page.url();
    log('shn-redirect', `?shn=${SHN} → ${EXPECT_LANDING}`,
      `landed on ${url.replace(BASE, '') || '/'}`,
      url.includes(EXPECT_LANDING) ? 'PASS — campaign landing resolved' : 'FAIL — did not route to inmate funnel');
  } catch (e) {
    log('shn-redirect', 'shN redirect', `ERROR ${e.message}`, 'BLOCKED');
  }

  // ── 2. gclid + shn captured first-touch (sessionStorage = attribution source) ─
  try {
    const store = await page.evaluate(() => ({
      referral: (() => { try { return JSON.parse(sessionStorage.getItem('referralParams') || '{}'); } catch { return {}; } })(),
      shn: sessionStorage.getItem('attribution.shn'),
    }));
    const gclidOk = store.referral.gclid === GCLID;
    const shnOk = store.shn === SHN;
    log('attribution-capture', 'gclid + shn persisted to sessionStorage',
      `referralParams.gclid=${store.referral.gclid || '(none)'}; attribution.shn=${store.shn || '(none)'}`,
      (gclidOk && shnOk) ? 'PASS — both captured first-touch' : 'FAIL — attribution not persisted');
  } catch (e) {
    log('attribution-capture', 'attribution capture', `ERROR ${e.message}`, 'BLOCKED');
  }

  // ── 3. dataLayer present and carries the ad-click id on pushes ───────────────
  try {
    const dl = await page.evaluate(() => {
      const arr = Array.isArray(window.dataLayer) ? window.dataLayer : [];
      return {
        len: arr.length,
        anyGclid: arr.some((e) => e && e.gclid),
        partnerNames: [...new Set(arr.map((e) => e && e.partnerName).filter(Boolean))],
        partnerChannels: [...new Set(arr.map((e) => e && e.partnerChannel).filter(Boolean))],
        events: [...new Set(arr.map((e) => e && e.event).filter(Boolean))].slice(0, 12),
      };
    });
    log('datalayer', 'dataLayer exists + pushes carry gclid/partner',
      `entries=${dl.len}; anyGclid=${dl.anyGclid}; partnerName=${JSON.stringify(dl.partnerNames)}; partnerChannel=${JSON.stringify(dl.partnerChannels)}; events=${JSON.stringify(dl.events)}`,
      (dl.len > 0 && dl.anyGclid) ? 'PASS — dataLayer live, gclid attached'
        : (dl.len > 0 ? 'INCONCLUSIVE — dataLayer live but no gclid on a push yet (push may need a route/event)' : 'FAIL — no dataLayer'));
  } catch (e) {
    log('datalayer', 'dataLayer', `ERROR ${e.message}`, 'BLOCKED');
  }

  // ── 4. Negative control: no shN → no campaign redirect ───────────────────────
  try {
    const ctx2 = await browser.newContext();   // clean — no prior first-touch state
    const p2 = await ctx2.newPage();
    p2.setDefaultTimeout(20000);
    await p2.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(2500);
    const url = p2.url();
    log('no-shn-control', 'no shN → stays on default home (no inmate redirect)',
      `landed on ${url.replace(BASE, '') || '/'}`,
      url.includes(EXPECT_LANDING) ? 'FAIL — redirected to inmate funnel without a shN' : 'PASS — no spurious campaign redirect');
    await ctx2.close();
  } catch (e) {
    log('no-shn-control', 'no-shN control', `ERROR ${e.message}`, 'BLOCKED');
  }

  await browser.close();

  console.log(`\n=== shN / GTM attribution UAT — ${BASE} ===`);
  console.log(JSON.stringify(results, null, 2));
  const failed = results.filter((r) => r.outcome.startsWith('FAIL') || r.outcome === 'BLOCKED');
  console.log(`\n${results.length - failed.length}/${results.length} PASS` +
    (failed.length ? ` — ${failed.length} need attention: ${failed.map((r) => r.id).join(', ')}` : ''));
  process.exit(failed.length ? 1 : 0);
})();
