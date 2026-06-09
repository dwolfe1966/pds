/* Probe: how do CONSUMER-authored userContact messages link to a user, and is
 * that link field honored as a server-side /database/search filter?
 *
 * Why: the CSR per-user Messages tab filters userContact by `targetUserId === userId`
 * server-side. Consumer-authored messages appear on the GENERAL inbox but NOT the
 * per-user tab — so they likely link via `owner`/email, not `targetUserId`. This
 * decides the fix: server-side merge (if owner/email are honored) vs broad-fetch +
 * client loose-match (if not). READ-ONLY. CSR creds from gitignored scripts/.smoke.env.
 *
 *   node scripts/verify-bc-usercontact-link.js
 */
const { chromium } = require('@playwright/test');
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

const BASE = 'https://dev.admin.www.bytecrtrs.com';
const USER = process.env.CSR_USER, PWD = process.env.CSR_PWD;
const out = { ran: true };

const ownerId = (d) => d?.owner?._id || d?.owner?.id || (typeof d?.owner === 'string' ? d.owner : null);
const docEmail = (d) => d?.content?.input?.email || d?.content?.email || d?.owner?.email || null;
const scoped = (docs, pred) => ({ count: docs.length, allMatch: docs.length > 0 && docs.every(pred), someMatch: docs.some(pred) });

(async () => {
  if (!USER || !PWD) { console.log(JSON.stringify({ ran: false, note: 'no CSR creds' })); return; }
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  // BC uses a per-endpoint apiId, so a generic clientId= query from one page 403s on
  // another. Capture auth from each endpoint's OWN request.
  let authQS = null;          // generic (for /database/search users lookup)
  let contactAuthQS = null;   // specifically valid for /contactMessage/admin/*
  page.on('request', (r) => {
    try {
      const url = new URL(r.url()); const s = url.search;
      if (/clientId=/.test(s)) authQS = s;
      if (/\/contactMessage\/admin\/find/.test(url.pathname) && /clientId=/.test(s)) contactAuthQS = s;
    } catch {}
  });

  // LOGIN
  await page.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"], input[name*="email" i], input[name*="user" i]').first().fill(USER).catch(() => {});
  await page.locator('input[type="password"]').first().fill(PWD).catch(() => {});
  await page.getByRole('button', { name: /log ?in|sign ?in|submit|continue/i }).first().click().catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4000);
  // visit users (for /database/search auth) then tickets (for contactMessage auth)
  await page.goto(`${BASE}/csr/users`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.goto(`${BASE}/csr/tickets`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  out.loggedIn = !/\/login/.test(page.url());
  out.capturedAuth = { generic: !!authQS, contact: !!contactAuthQS };
  if (!authQS || !contactAuthQS) { out.note = 'auth capture incomplete'; console.log(JSON.stringify(out, null, 2)); await browser.close(); return; }

  const search = (body) => ctx.request.post(`${BASE}/api/database/search${authQS}`, { data: body, timeout: 30000 })
    .then(async (r) => {
      const j = await r.json().catch(() => ({}));
      const docs = j?.docs ?? j?.raws ?? j?.users ?? j?.data ?? (Array.isArray(j) ? j : []);
      return { status: r.status(), docs, envKeys: Object.keys(j || {}).slice(0, 10) };
    })
    .catch((e) => ({ error: e.message, docs: [] }));

  const getInbox = () => ctx.request.get(`${BASE}/api/contactMessage/admin/find${contactAuthQS}`, { timeout: 30000 })
    .then(async (r) => { const j = await r.json().catch(() => ({})); return { status: r.status(), docs: j?.docs ?? j?.data ?? (Array.isArray(j) ? j : []), envKeys: Object.keys(j || {}).slice(0, 10) }; })
    .catch((e) => ({ error: e.message, docs: [] }));
  const getPerUser = (uid) => ctx.request.post(`${BASE}/api/contactMessage/admin/find/${encodeURIComponent(uid)}${contactAuthQS}`, { data: {}, timeout: 30000 })
    .then(async (r) => { const j = await r.json().catch(() => ({})); return { status: r.status(), docs: j?.docs ?? j?.data ?? (Array.isArray(j) ? j : []), envKeys: Object.keys(j || {}).slice(0, 10) }; })
    .catch((e) => ({ error: e.message, docs: [] }));

  // 1) General inbox list (the WORKING path) — dump shapes
  const all = await getInbox();
  out.broadCount = all.docs.length;
  out.broadMeta = { status: all.status, envKeys: all.envKeys, error: all.error };
  out.inboxShapes = all.docs.slice(0, 8).map((d) => ({
    type: d.type, hasOwner: !!d.owner, ownerId: ownerId(d),
    targetUserId: d.targetUserId || d?.content?.targetUserId || null,
    email: docEmail(d), keys: Object.keys(d).slice(0, 24),
  }));
  // Inbox docs link to the SENDER by email (targetUserId/owner are null). So: for
  // each distinct sender email, find the matching member, then compare what BC's
  // per-user endpoint returns (the bug) vs an email loose-match over the inbox (the fix).
  const userByEmail = (email) => search({ collectionName: 'users', query: { email }, brandId: 'idlookup' })
    .then((r) => r.docs.find((u) => (docEmail(u) || u.email || '').toLowerCase() === email.toLowerCase()) || r.docs[0] || null);

  const senderEmails = [...new Set(all.docs.map(docEmail).filter(Boolean).map((e) => e.toLowerCase()))];
  out.distinctSenderEmails = senderEmails.slice(0, 8);
  out.beforeAfter = [];
  for (const email of senderEmails.slice(0, 6)) {
    const u = await userByEmail(email);
    const uid = u && (u._id || u.id);
    const emailMatchCount = all.docs.filter((d) => (docEmail(d) || '').toLowerCase() === email).length;
    if (!uid) { out.beforeAfter.push({ email, memberFound: false, emailMatchCount }); continue; }
    const perUser = await getPerUser(uid);             // BEFORE: targetUserId-only (the bug)
    out.beforeAfter.push({
      email, memberFound: true, uid,
      perUserEndpointStatus: perUser.status,
      perUserEndpointCount: perUser.docs.length,       // expect 0 (no targetUserId on these docs)
      emailLooseMatchCount: emailMatchCount,           // expect >0 (the fix surfaces these)
      FIX_RECOVERS: perUser.docs.length === 0 && emailMatchCount > 0,
    });
  }

  console.log('===== USERCONTACT LINK PROBE =====');
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
