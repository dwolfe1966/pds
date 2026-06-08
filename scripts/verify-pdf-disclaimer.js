/* Verify whether the BC-generated PDF still carries a "fictional data" disclaimer
 * (docs/BC_PDF_DISCLAIMER.md). READ-ONLY. Member creds from gitignored scripts/.smoke.env.
 * Logs in, opens an existing report (click, no captcha), clicks Download PDF, captures
 * the PDF bytes (download event OR application/pdf response), saves to /tmp, and the
 * caller runs pdftotext + grep. Usage: node scripts/verify-pdf-disclaimer.js
 */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(function loadSmokeEnv() {
  const f = path.join(__dirname, '.smoke.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let val = m[2].trim().replace(/^['"‘’“”]|['"‘’“”]$/g, '');
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
})();

const BASE = 'https://dev.www.idlookup.ai';
const OUT = '/tmp/uat-0608';
fs.mkdirSync(OUT, { recursive: true });
const EMAIL = process.env.MEMBER_EMAIL, PWD = process.env.MEMBER_PWD;
const REPORT_ID = process.env.REPORT_ID || '6a25df363ee3447608a236a7';

(async () => {
  if (!EMAIL || !PWD) { console.log(JSON.stringify({ ran: false, note: 'no member creds' })); return; }
  const browser = await chromium.launch({ acceptDownloads: true });
  const ctx = await browser.newContext({ ...devices['Galaxy S5'], acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);
  const result = { ran: true };
  let pdfPath = null;

  // capture either a real download or a pdf response body
  page.on('download', async (d) => {
    try { pdfPath = path.join(OUT, 'report.pdf'); await d.saveAs(pdfPath); result.captured = 'download-event'; }
    catch (e) { result.downloadErr = e.message; }
  });
  page.on('response', async (resp) => {
    try {
      const ct = (resp.headers()['content-type'] || '').toLowerCase();
      if (ct.includes('application/pdf') || /\.pdf(\?|$)/i.test(resp.url())) {
        const buf = await resp.body();
        pdfPath = path.join(OUT, 'report.pdf');
        fs.writeFileSync(pdfPath, buf);
        result.captured = 'pdf-response';
        result.pdfUrl = resp.url().replace(BASE, '');
      }
    } catch {}
  });
  // BC "native download popup" = window.open(pdfUrl) → capture the popup's URL and
  // re-fetch it through the authenticated context (cookies attached).
  ctx.on('page', async (popup) => {
    try {
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      const url = popup.url();
      result.popupUrl = url.replace(BASE, '');
      if (/^https?:/.test(url)) {
        const resp = await ctx.request.get(url);
        const ct = (resp.headers()['content-type'] || '').toLowerCase();
        const buf = await resp.body();
        if (ct.includes('pdf') || buf.slice(0, 5).toString() === '%PDF-') {
          pdfPath = path.join(OUT, 'report.pdf');
          fs.writeFileSync(pdfPath, buf);
          result.captured = 'popup-fetch';
        } else {
          result.popupContentType = ct;
        }
      }
    } catch (e) { result.popupErr = e.message; }
  });

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[type="email"], input[name*="email" i]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PWD);
    await page.getByRole('button', { name: /log ?in|sign ?in/i }).first().click().catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);

    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const hrefs = await page.locator('a[href*="/people/"]').evaluateAll(els => els.map(e => e.getAttribute('href')).filter(Boolean));
    const target = hrefs.find(h => h && h.includes(REPORT_ID)) || hrefs[0];
    result.openedVia = target;
    await page.locator(`a[href="${target}"]`).first().click().catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(4000);
    result.onReport = /\/people\//.test(page.url());

    // The IIFE pops a confirm modal ("Would you like to download the PDF?") with a
    // 'Confirm' button, THEN does GET /idLookup/report/pdf/<id> (apiId/clientId
    // injected by the wrapper — a raw fetch 400s). Click button → Confirm → the
    // response interceptor above captures the application/pdf blob.
    const pdfBtn = page.getByRole('button', { name: /download pdf|⬇/i })
      .or(page.locator('button:has-text("PDF")')).first();
    result.pdfButton = await pdfBtn.count();
    if (await pdfBtn.count()) {
      await pdfBtn.click().catch((e) => { result.clickErr = e.message; });
      await page.waitForTimeout(1200);
      const confirm = page.getByRole('button', { name: /^\s*confirm\s*$/i })
        .or(page.locator('button:has-text("Confirm")')).first();
      result.confirmModal = await confirm.count();
      if (await confirm.count()) await confirm.click().catch((e) => { result.confirmErr = e.message; });
      await page.waitForTimeout(10000); // BC generates + returns the PDF blob
    }
    result.pdfSaved = pdfPath && fs.existsSync(pdfPath) ? pdfPath : null;
    result.pdfBytes = result.pdfSaved ? fs.statSync(pdfPath).size : 0;
    // surface any in-page PDF error the component recorded
    result.pagePdfError = await page.evaluate(() => (window._lastPdfError ? JSON.stringify(window._lastPdfError).slice(0, 300) : null)).catch(() => null);
  } catch (e) { result.error = e.message; }

  await browser.close();
  console.log(JSON.stringify(result, null, 2));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
