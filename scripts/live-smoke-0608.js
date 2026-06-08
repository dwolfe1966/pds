/* Live functional smoke — 2026-06-08. READ-ONLY. Verifies the report-parity work
 * (consumer) and CSR user-detail tabs (admin) against the REAL live hosts, which we
 * confirmed == HEAD build (consumer public.772bfb29 / admin admin.eff24bd1).
 *
 * Run (creds via env, NEVER hardcoded — paste inline, don't commit):
 *   MEMBER_EMAIL=.. MEMBER_PWD=.. CSR_USER=.. CSR_PWD=.. node scripts/live-smoke-0608.js
 * Either pair can be omitted to skip that half. Optional:
 *   REPORT_ID=6a25df363ee3447608a236a7  (default: O.J. report; else first library report)
 *   CSR_SEARCH=test21@test21.com
 *
 * No new searches are run (those hit the BC captcha wall) — we open an EXISTING report
 * from the dashboard library and an EXISTING CSR user detail. Screenshots → /tmp/uat-0608.
 */
const { chromium, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Load creds from a gitignored scripts/.smoke.env (KEY=VALUE per line) so they
// never appear on the command line, in shell history, or in this chat. Values
// already set in the real environment win. Quotes around values are stripped.
(function loadSmokeEnv() {
  const f = path.join(__dirname, '.smoke.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const key = m[1];
    let val = m[2].trim().replace(/^['"‘’“”]|['"‘’“”]$/g, '');
    if (process.env[key] === undefined) process.env[key] = val;
  }
})();

const CBASE = 'https://dev.www.idlookup.ai';
const ABASE = 'https://dev.admin.www.bytecrtrs.com';
const SHOTS = '/tmp/uat-0608';
fs.mkdirSync(SHOTS, { recursive: true });

const M_EMAIL = process.env.MEMBER_EMAIL, M_PWD = process.env.MEMBER_PWD;
const C_USER = process.env.CSR_USER, C_PWD = process.env.CSR_PWD;
const REPORT_ID = process.env.REPORT_ID || '6a25df363ee3447608a236a7';
const CSR_SEARCH = process.env.CSR_SEARCH || 'test21@test21.com';

const out = {};
const has = (t, re) => re.test(t);

async function consumerSmoke(browser) {
  const r = { ran: true };
  const page = await (await browser.newContext({ ...devices['Galaxy S5'] })).newPage();
  page.setDefaultTimeout(20000);
  try {
    // login
    await page.goto(`${CBASE}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[type="email"], input[name*="email" i]').first().fill(M_EMAIL);
    await page.locator('input[type="password"]').first().fill(M_PWD);
    await page.getByRole('button', { name: /log ?in|sign ?in/i }).first().click().catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3500);
    r.loggedIn = !/\/login/.test(page.url());

    // Open an EXISTING library report by CLICKING the link (in-app SPA nav) so the
    // already-hydrated paid status survives — a full page.goto() to /people/:id
    // re-boots the app and the narrow paywall redirects before getOrders() resolves.
    // REPORT_ID is opened only if it's actually in THIS member's library; otherwise
    // we open the member's first own report (the rich BC data is present on those).
    let opened = false;
    let t = '';
    const onReport = () => /\/people\//.test(page.url());
    await page.goto(`${CBASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // let AuthContext hydrate paid status
    const hrefs = await page.locator('a[href*="/people/"]').evaluateAll(els =>
      els.map(e => e.getAttribute('href')).filter(Boolean));
    r.libraryReportCount = hrefs.length;
    const target = hrefs.find(h => h && h.includes(REPORT_ID)) || hrefs[0];
    if (target) {
      r.openedVia = target;
      await page.locator(`a[href="${target}"]`).first().click().catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(4500);
      t = await page.locator('body').innerText();
      opened = onReport();
      if (!opened) r.redirectedTo = page.url().replace(CBASE, '');
    } else { r.note = 'no /people/ links in dashboard library'; }

    r.reportUrl = page.url().replace(CBASE, '');
    r.captchaBlocked = has(t, /input password|captcha/i);
    r.bodyLen = t.length;
    await page.screenshot({ path: `${SHOTS}/consumer-report.png`, fullPage: true });

    // sections present
    r.sections = ['overview','contact','phone','email','address','relatives','associates',
      'criminal','court','financial','property','license','social','employment','education']
      .filter(s => new RegExp(s, 'i').test(t));

    // ---- the report-parity fields we shipped this sprint ----
    r.parity = {
      // address breadth
      county: has(t, /county/i),
      zip4: /\b\d{5}-\d{4}\b/.test(t),
      ownership: has(t, /ownership|owner\b|renter/i),
      residenceDuration: has(t, /\d+(\.\d+)?\s*(yr|year|mo|month)/i),
      mapLink: await page.locator('a[href*="maps.google"], a[href*="google.com/maps"], a:has-text("Map")').count(),
      // property card (was blank before)
      assessed: has(t, /assessed|market value/i),
      bedsBaths: has(t, /bed|bath/i),
      lastSale: has(t, /last sale|sale date|sold/i),
      // criminal physical descriptors
      height: has(t, /height/i),
      weight: has(t, /weight/i),
      hairEyes: has(t, /hair|eyes/i),
      description: has(t, /description/i),
      mugshot: await page.locator('img[alt*="mug" i], img[alt*="photo" i], img[src*="photo"]').count(),
      // financial
      lien: has(t, /lien/i),
    };
    r.opened = opened;
  } catch (e) { r.error = e.message; }
  return r;
}

async function csrSmoke(browser) {
  const r = { ran: true };
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(25000);
  const txt = () => page.locator('body').innerText();
  try {
    await page.goto(`${ABASE}/csr/login`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.locator('input[type="email"], input[name*="email" i], input[name*="user" i]').first().fill(C_USER).catch(() => {});
    await page.locator('input[type="password"]').first().fill(C_PWD).catch(() => {});
    await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(5000);
    let t = await txt();
    r.loggedIn = !/\/login/.test(page.url()) && !/log ?in|sign ?in/i.test(page.url());
    r.forbidden = has(t, /forbidden|not authorized|access denied/i);

    // search a known user
    await page.goto(`${ABASE}/csr/users`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    const sb = page.locator('input[type="search"], input[placeholder*="search" i], input[type="text"]').first();
    if (await sb.count()) { await sb.fill(CSR_SEARCH); await sb.press('Enter').catch(() => {}); }
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${SHOTS}/csr-search.png`, fullPage: true });
    r.searchRows = await page.locator('a[href*="/users/"]').count();

    // open user detail
    const link = page.locator('a[href*="/users/"]').first();
    if (await link.count()) {
      await link.click(); await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(4500);
      t = await txt();
      r.userUrl = page.url().replace(ABASE, '');
      r.whitePage = t.trim().length < 60;
      r.tabsPresent = ['Orders','Payments','Searches','Reports','Logins','Notes','Messages']
        .filter(x => new RegExp(x, 'i').test(t));
      r.collectedShown = /collected/i.test(t);
      await page.screenshot({ path: `${SHOTS}/csr-user-detail.png`, fullPage: true });

      // click each data tab and record whether it populates vs empties
      for (const tab of ['Searches', 'Reports', 'Logins', 'Notes']) {
        await page.getByText(new RegExp(`^\\s*${tab}\\b`, 'i')).first().click().catch(() => {});
        await page.waitForTimeout(2500);
        const tt = await txt();
        r[`tab_${tab}`] = {
          empty: /no\s+(searches|reports|logins|notes|messages|records|results|data)|nothing here/i.test(tt),
          rows: await page.locator('table tbody tr, [role="row"]').count(),
        };
        await page.screenshot({ path: `${SHOTS}/csr-tab-${tab}.png`, fullPage: true }).catch(() => {});
      }

      // notes & messages combined
      await page.getByText(/notes\s*&?\s*messages|^\s*messages/i).first().click().catch(() => {});
      await page.waitForTimeout(2500);
      const tn = await txt();
      r.notesMessages = {
        notesShown: /note|internal/i.test(tn),
        messagesShown: /message|ticket|contact/i.test(tn),
        emptyBoth: /no notes.*no messages|nothing here/i.test(tn),
      };
      await page.screenshot({ path: `${SHOTS}/csr-notes-messages.png`, fullPage: true });
    } else r.userDetail = 'no user link to open';
  } catch (e) { r.error = e.message; }
  return r;
}

(async () => {
  const browser = await chromium.launch();
  if (M_EMAIL && M_PWD) out.consumer = await consumerSmoke(browser);
  else out.consumer = { ran: false, note: 'MEMBER_EMAIL/MEMBER_PWD not set — skipped' };
  if (C_USER && C_PWD) out.csr = await csrSmoke(browser);
  else out.csr = { ran: false, note: 'CSR_USER/CSR_PWD not set — skipped' };
  await browser.close();
  console.log('\n===== LIVE SMOKE 2026-06-08 =====');
  console.log(JSON.stringify(out, null, 2));
  console.log('\nScreenshots → ' + SHOTS);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
