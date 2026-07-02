/* SEO coverage probe — DEV ONLY, READ-ONLY (teaser searches, no report creation, no billing).
 * Answers: name aggregation depth/pagination, per-record teaser fields (locations, relatives,
 * counts, age), national vs state search, extId stability across repeat searches.
 * Kicks off searchTeaser on the app's own IIFE singleton, solves the IIFE captcha modal via
 * real Playwright interactions (never hand-rolls contextKey — uses the enum), reads the result.
 * Usage: node scripts/probe-seo-teaser.js
 */
const { chromium } = require('@playwright/test');
const fs = require('fs');
const BASE = process.env.BASE || 'https://dev.www.idlookup.ai';
const isDev = /(^|\.)dev\./.test(new URL(BASE).host);
const CAPTCHA_PW = process.env.CAPTCHA_PW || (isDev ? 'bcEdgeApiPass123!@#' : '');
const OUT_DIR = process.env.OUT_DIR || '/tmp/seo-probe';
if (!isDev) { console.error('DEV ONLY — refusing to probe non-dev host'); process.exit(1); }

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const net = [];
  page.on('response', async (r) => {
    if (!/teaser\/search/.test(r.url())) return;
    let b = ''; try { b = (await r.text()).slice(0, 400); } catch {}
    net.push(`${r.status()} ${b}`);
  });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction(() => !!window.ApiWrapper, { timeout: 20000 });
  await page.evaluate((pw) => { window.__CAP = pw; }, CAPTCHA_PW);

  // Solve the IIFE "Input Password" captcha modal via real DOM interaction.
  async function solveCaptcha() {
    for (let i = 0; i < 12; i++) {
      const hasModal = await page.evaluate(() => /input password/i.test(document.body.innerText));
      if (hasModal) {
        const pw = page.locator('input[type="password"]');
        if (await pw.count()) {
          await pw.last().fill(CAPTCHA_PW).catch(() => {});
          await page.getByRole('button', { name: /confirm|submit|ok/i }).first().click().catch(() => {});
          await page.waitForTimeout(2000);
        }
      } else if (i > 0) { break; }
      await page.waitForTimeout(1200);
      const gone = await page.evaluate(() => !!window.__seo && window.__seo.done);
      if (gone) break;
    }
  }

  // Start search non-blocking; stash result on window. Uses the app's singleton IIFE.
  async function startSearch(params, maxMorePages) {
    await page.evaluate(({ params, maxMorePages }) => {
      window.__seo = { done: false };
      (async () => {
        try {
          const w = window.ApiWrapper.getInstance({ endpointUrl: '/api' });
          // Dev-only: feed BC's password.v0 captcha the known dev token directly,
          // exactly as the app does via REACT_APP_NEW_API_CAPTCHA (no modal, no secret in bundle).
          if (w.captcha && typeof w.captcha.executePasswordCaptcha === 'function') {
            w.captcha.executePasswordCaptcha = async () => ({ token: window.__CAP });
          }
          const q = { ...params, type: 'name', contextKey: window.ApiWrapper.contextKey.sale.name.teaser };
          const resp = await w.api.idLookup.searchTeaser(q);
          const ids = (resp.getIdentities && resp.getIdentities()) || [];
          const pages = [ids];
          let more = resp.hasMore && resp.hasMore();
          for (let i = 0; i < maxMorePages && more; i++) {
            const next = await resp.getMore();
            const arr = Array.isArray(next) ? next : (next && next.getIdentities && next.getIdentities()) || [];
            pages.push(arr);
            more = resp.hasMore && resp.hasMore();
            if (!arr.length) break;
          }
          let raw = null;
          try { const d = resp.getData ? resp.getData() : null; raw = d?.params?.response?.data ?? d?.data ?? d; } catch {}
          raw = raw || resp?.params?.response?.data || resp;
          const raws = raw?.raws ?? raw?.commerceContent?.raws ?? [];
          const t = (Array.isArray(raws) ? raws.find((r) => r?.transient?.identities) : null)?.transient || {};
          const all = pages.flat().filter((x) => x && typeof x === 'object');
          window.__seo = {
            done: true,
            failedCode: resp.getFailedCode ? resp.getFailedCode() : null,
            total: t.total ?? null, perPage: t.perPage ?? null,
            pageSizes: pages.map((p) => p.length),
            identityKeys: all[0] ? Object.keys(all[0]) : [],
            firstIdentity: all[0] || null,
            secondIdentity: all[1] || null,
            extIds: all.map((i) => i.extId),
            names: all.slice(0, 10).map((i) => i.nameList?.[0]?.data),
            teaserInput: resp.getTeaserInput ? resp.getTeaserInput() : null,
          };
        } catch (e) { window.__seo = { done: true, error: String(e && e.message || e) }; }
      })();
    }, { params, maxMorePages });
  }

  async function readResult() {
    for (let i = 0; i < 40; i++) {
      const d = await page.evaluate(() => window.__seo);
      if (d && d.done) return d;
      await page.waitForTimeout(1000);
    }
    return { done: false, error: 'TIMEOUT' };
  }

  const results = {};
  const CASES = [
    ['john-smith-tx', { fName: 'John', lName: 'Smith', state: 'TX' }, 4],
    ['john-smith-national', { fName: 'John', lName: 'Smith' }, 1],
    ['tim-chin-fl', { fName: 'Tim', lName: 'Chin', state: 'FL' }, 4],
    ['orville-klingensmith', { fName: 'Orville', lName: 'Klingensmith' }, 1],
    ['john-smith-tx-repeat', { fName: 'John', lName: 'Smith', state: 'TX' }, 0],
  ];
  for (const [tag, params, morePages] of CASES) {
    process.stdout.write(`\n=== ${tag} ===\n`);
    try {
      await startSearch(params, morePages);
      await solveCaptcha();
      const r = await readResult();
      results[tag] = r;
      fs.writeFileSync(`${OUT_DIR}/${tag}.json`, JSON.stringify(r, null, 2));
      const { firstIdentity, secondIdentity, extIds, ...brief } = r;
      console.log(JSON.stringify({ ...brief, extIdCount: extIds ? extIds.length : 0, extIdSample: extIds ? extIds.slice(0, 2) : null }, null, 1));
    } catch (e) { console.log('CASE FATAL: ' + String(e.message).slice(0, 200)); results[tag] = { fatal: String(e.message) }; }
    await page.waitForTimeout(1500);
  }

  const a = results['john-smith-tx'], b = results['john-smith-tx-repeat'];
  if (a?.extIds && b?.extIds) {
    const setA = new Set(a.extIds);
    const overlap = b.extIds.filter((x) => setA.has(x)).length;
    console.log(`\nextId stability: run1 ${a.extIds.length} ids, run2 ${b.extIds.length} ids, overlap ${overlap}`);
  }
  fs.writeFileSync(`${OUT_DIR}/_all.json`, JSON.stringify(results, null, 2));
  fs.writeFileSync(`${OUT_DIR}/_net.json`, JSON.stringify(net, null, 2));
  console.log('\nNET (' + net.length + '):');
  net.slice(0, 20).forEach((n) => console.log('  ' + n));
  console.log(`\nSaved to ${OUT_DIR}`);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
