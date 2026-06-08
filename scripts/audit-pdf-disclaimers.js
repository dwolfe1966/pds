/* Audit the "fictional data" disclaimer across ALL of a member's report PDFs.
 * READ-ONLY. Member creds from gitignored scripts/.smoke.env.
 *
 * Strategy: log in, enumerate the dashboard's report links, trigger ONE PDF via the
 * button+Confirm modal to capture the session's clientId/apiId query params, then fetch
 * every report's PDF directly (GET /idLookup/report/pdf/<id>?clientId&apiId) and scan
 * each for the disclaimer. Definitive per-report matrix. Usage: node scripts/audit-pdf-disclaimers.js
 */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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
const OUT = '/tmp/uat-0608/pdfaudit';
fs.mkdirSync(OUT, { recursive: true });
const EMAIL = process.env.MEMBER_EMAIL, PWD = process.env.MEMBER_PWD;
const DISC_RE = /fiction|fictitious|sample data|illustrat|not a consumer report/i;

function pdfText(file) {
  try { const txt = file.replace(/\.pdf$/, '.txt'); execFileSync('pdftotext', [file, txt]); return fs.readFileSync(txt, 'utf8'); }
  catch { return ''; }
}

(async () => {
  if (!EMAIL || !PWD) { console.log('no member creds'); return; }
  const browser = await chromium.launch({ acceptDownloads: true });
  const ctx = await browser.newContext({ ...devices['Galaxy S5'], acceptDownloads: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);
  let authQS = null;
  const grabQS = (u) => { try { const s = new URL(u).search; if (/clientId=/.test(s)) authQS = s; } catch {} };
  page.on('download', (d) => grabQS(d.url()));
  page.on('request', (r) => { if (/\/report\/pdf\//.test(r.url())) grabQS(r.url()); });
  page.on('response', (r) => { if (/\/report\/pdf\//.test(r.url())) grabQS(r.url()); });
  const CAPTURE_ID = '6a25df363ee3447608a236a7'; // O.J. — reliably generates a PDF

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="email"], input[name*="email" i]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PWD);
  await page.getByRole('button', { name: /log ?in|sign ?in/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const ids = [...new Set((await page.locator('a[href*="/people/"]').evaluateAll(
    els => els.map(e => (e.getAttribute('href') || '').split('/people/')[1]).filter(Boolean)))
    .map(s => s.split(/[/?#]/)[0]))];
  console.log(`Found ${ids.length} report(s): ${ids.join(', ')}`);

  // Open the O.J. report → trigger one PDF to capture clientId/apiId from the request URL.
  const capId = ids.includes(CAPTURE_ID) ? CAPTURE_ID : ids[0];
  if (capId) {
    await page.locator(`a[href*="/people/${capId}"]`).first().click().catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3500);
    const btn = page.getByRole('button', { name: /download pdf|⬇/i }).or(page.locator('button:has-text("PDF")')).first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(1200);
      const confirm = page.getByRole('button', { name: /^\s*confirm\s*$/i }).or(page.locator('button:has-text("Confirm")')).first();
      if (await confirm.count()) await confirm.click().catch(() => {});
      await page.waitForTimeout(8000);
    }
  }
  if (!authQS) { console.log('Could not capture PDF auth params (clientId/apiId) — aborting.'); await browser.close(); return; }

  // Fetch every report's PDF directly and scan.
  const rows = [];
  for (const id of ids) {
    const url = `${BASE}/api/idLookup/report/pdf/${id}${authQS}`;
    try {
      const resp = await ctx.request.get(url, { timeout: 30000 });
      const buf = await resp.body();
      const isPdf = buf.slice(0, 5).toString() === '%PDF-';
      let hasDisc = null, name = '';
      if (isPdf) {
        const file = path.join(OUT, `${id}.pdf`);
        fs.writeFileSync(file, buf);
        const txt = pdfText(file);
        hasDisc = DISC_RE.test(txt);
        name = (txt.match(/Full Name\s+([A-Z][A-Z .'-]+)/) || [])[1] || (txt.split('\n').find(l => /residence/i.test(l)) || '').slice(0, 40);
      }
      rows.push({ id, status: resp.status(), bytes: buf.length, isPdf, hasDisclaimer: hasDisc, who: name.trim() });
    } catch (e) { rows.push({ id, error: e.message }); }
  }
  await browser.close();
  console.log('\n===== PDF DISCLAIMER AUDIT =====');
  for (const r of rows) console.log(JSON.stringify(r));
  const pdfs = rows.filter(r => r.isPdf);
  const withDisc = pdfs.filter(r => r.hasDisclaimer);
  console.log(`\n${withDisc.length}/${pdfs.length} report PDFs still contain the disclaimer.`);
  if (withDisc.length) console.log('WITH disclaimer:', withDisc.map(r => r.id).join(', '));
  console.log('CLEAN:', pdfs.filter(r => !r.hasDisclaimer).map(r => r.id).join(', ') || '(none)');
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
