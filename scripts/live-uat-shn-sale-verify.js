/* Headed "network recorder" to verify shN + gclid + partner land on a REAL order.
 *
 * It does NOT automate the funnel (captcha + bot-detection + real card make that
 * brittle). Instead it opens a real browser at the full campaign test URL and YOU
 * drive the funnel by hand — search, solve the captcha, unlock, enter the test card,
 * submit the $1 trial. The script silently intercepts BC's shape/compiled + the
 * commerceBilling/sale response and prints the attribution fields off the actual
 * created order. You keep full control of the charge (the script never enters a card
 * or clicks Pay). Void the $1 order afterward via CSR if you like.
 *
 *   node scripts/live-uat-shn-sale-verify.js
 *
 * Result is also written to scripts/out/shn-sale-verify.json when the sale lands.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const SITE = process.env.CONSUMER_SITE || 'https://dev.www.idlookup.ai';
const SHN = process.env.SHN || '6a22ff83ca16ad4ef68b84b5'; // Google Inmates Upper
const GCLID = process.env.GCLID || 'CjwKTEST_shn_verify_0001';
const TEST_URL =
  `${SITE}/?shn=${SHN}&gclid=${GCLID}` +
  `&utm_source=google&utm_medium=cpc&utm_campaign=inmates-upper&utm_term=find+an+inmate` +
  `&refer_partnerId=google&refer_afid=g-inmates-upper&refer_abc=ag6813043751`;

const OUT_DIR = path.join(__dirname, 'out');
const OUT_FILE = path.join(OUT_DIR, 'shn-sale-verify.json');

const pick = (obj, keys) => keys.reduce((a, k) => (obj && obj[k] !== undefined ? ((a[k] = obj[k]), a) : a), {});
function deepFind(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const v of Object.values(obj)) { const r = deepFind(v, key, depth + 1); if (r !== undefined) return r; }
  return undefined;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(0);

  const result = { site: SITE, shn: SHN, gclid: GCLID, testUrl: TEST_URL, shape: null, sale: null, orderHits: [], saleSeenAt: null };
  let saleSeen = false;

  page.on('response', async (resp) => {
    const u = resp.url();
    if (!/\/api\//i.test(u)) return;
    let txt;
    try { txt = await resp.text(); } catch { return; }
    if (!txt) return;

    try {
      // 1) shape resolution (already verified, but capture for completeness)
      if (/shape\/compiled/i.test(u) && !result.shape) {
        const j = JSON.parse(txt);
        result.shape = { shConId: j.shConId, shColId: j.shColId, containerName: j.containerName };
        console.log(`\n[shape] shConId=${j.shConId}  (${j.containerName})`);
      }

      // 2) the sale call itself
      if (/commerceBilling\/sale/i.test(u)) {
        let body; try { body = JSON.parse(txt); } catch { body = txt; }
        result.sale = {
          httpStatus: resp.status(),
          orderId: deepFind(body, 'orderId') || deepFind(body, '_id'),
          shConId: deepFind(body, 'shConId') || null,
          refer: deepFind(body, 'refer') || null,
          partner: deepFind(body, 'partner') || null,
          rawSnippet: txt.slice(0, 1200),
        };
        result.saleSeenAt = new Date().toISOString();
        saleSeen = true;
        console.log('\n[sale] commerceBilling/sale captured (status ' + resp.status() + ')');
      }

      // 3) order attribution wherever it surfaces — sale, getOrders, order detail.
      // Any /api/ response whose body carries shConId is an order-bearing payload.
      if (txt.includes('"shConId"') && result.orderHits.length < 8) {
        let body; try { body = JSON.parse(txt); } catch { return; }
        const order = deepFind(body, 'commerceOrder') || deepFind(body, 'order') || body;
        const hit = {
          endpoint: u.replace(SITE, '').slice(0, 80),
          shConId: deepFind(order, 'shConId') || null,
          shColId: deepFind(order, 'shColId') || null,
          refer: deepFind(order, 'refer') || deepFind(body, 'refer') || null,
          partner: deepFind(order, 'partner') || deepFind(body, 'partner') || null,
          orderId: deepFind(order, 'orderId') || deepFind(order, '_id') || null,
        };
        // skip the shape/compiled doc (it has shConId but isn't an order)
        if (!/shape\/compiled/i.test(u)) {
          result.orderHits.push(hit);
          fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
          console.log(`\n[order-hit] ${hit.endpoint}  shConId=${hit.shConId}  partner=${JSON.stringify(hit.partner)}  refer=${JSON.stringify(hit.refer)}`);
        }
      }
    } catch (_) { /* ignore parse/stream errors */ }
  });

  console.log('\n────────────────────────────────────────────────────────');
  console.log(' shN SALE VERIFY — a browser window just opened.');
  console.log(' Do the funnel BY HAND in that window:');
  console.log('   1) Search a name → solve the BC captcha when it appears');
  console.log('   2) Unlock / continue to signup → payment');
  console.log('   3) Enter the BC test card, submit the $1 trial');
  console.log(' The script watches the network and prints the order attribution.');
  console.log(` Test URL: ${TEST_URL}`);
  console.log('────────────────────────────────────────────────────────\n');

  await page.goto(TEST_URL, { waitUntil: 'domcontentloaded' });

  // Wait (up to 25 min) for the sale response, then dump + leave the browser open
  // briefly so you can read the confirmation. Ctrl-C anytime to stop early.
  const deadline = Date.now() + 25 * 60 * 1000;
  while (!saleSeen && Date.now() < deadline) { await page.waitForTimeout(3000); }

  if (!saleSeen) {
    console.log('\n[timeout] No commerceBilling/sale response seen. Shape captured:', JSON.stringify(result.shape));
    fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
  } else {
    // Pick the best attribution source: an order-hit carrying our shN, else the
    // first order-hit, else the sale response.
    const best = result.orderHits.find((h) => h.shConId === SHN)
      || result.orderHits[0]
      || result.sale
      || {};
    const okShn = best.shConId === SHN;
    const referStr = JSON.stringify(best.refer || {});
    const okGclid = referStr.includes(GCLID);
    const okPartner = JSON.stringify(best.partner || {}).toLowerCase().includes('google');
    console.log('VERDICT (source: ' + (best.endpoint || 'sale') + '):');
    console.log(`  shN on order:     ${okShn ? 'PASS' : 'CHECK'} (order.shConId=${best.shConId})`);
    console.log(`  gclid on order:   ${okGclid ? 'PASS' : 'CHECK'} (refer=${referStr})`);
    console.log(`  partner=google:   ${okPartner ? 'PASS' : 'CHECK'} (partner=${JSON.stringify(best.partner)})`);
    if (!result.orderHits.length) {
      console.log('  NOTE: no order-bearing payload exposed shConId to the client — read the order via CSR to confirm.');
    }
    await page.waitForTimeout(8000);
  }

  console.log(`\nResult written to ${OUT_FILE}`);
  await browser.close();
})();
