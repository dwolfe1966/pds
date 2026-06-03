/* Test the CSR note-create path live. Creds via env. Adds one clearly-marked
 * TEST note to a test user and captures the create request + status, to find
 * the messageCreate regression BC flagged. */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.admin.www.bytecrtrs.com';
const UID = process.env.TARGET_UID || '6a1e5cfd68c31e075cb1011c';
const reqs = [];

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.setDefaultTimeout(25000);
  // capture all message/note/contact create traffic with status
  p.on('response', async (r) => {
    const u = r.url();
    if (/createNote|note\/create|contactMessage|message\/admin|csrReply/i.test(u)) {
      let body = null;
      try { body = await r.json(); } catch { body = null; }
      reqs.push({ status: r.status(), method: r.request().method(), url: u.split('?')[0].replace(BASE, ''),
        reqBody: (() => { try { return r.request().postDataJSON(); } catch { return r.request().postData()?.slice(0, 200); } })(),
        respKeys: body && typeof body === 'object' ? Object.keys(body).slice(0, 8) : body });
    }
  });

  await p.goto(`${BASE}/csr/login`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  await p.locator('input[type="email"], input[name*="user" i]').first().fill(process.env.CSR_USER);
  await p.locator('input[type="password"]').first().fill(process.env.CSR_PWD);
  await p.getByRole('button', { name: /log ?in|sign ?in|submit/i }).first().click().catch(() => {});
  await p.waitForTimeout(4000);

  await p.goto(`${BASE}/csr/users/${UID}`, { waitUntil: 'networkidle' }); await p.waitForTimeout(3000);
  // Notes & Messages tab
  await p.getByText(/notes\s*&\s*messages/i).first().click().catch(() => {});
  await p.waitForTimeout(2000);
  // Add Note
  await p.getByRole('button', { name: /add note|new note/i }).first().click().catch(() => {});
  await p.waitForTimeout(1000);
  const ta = p.locator('textarea, input[type="text"]').last();
  await ta.fill('TEST note (messageCreate regression check) — please ignore').catch(() => {});
  await p.screenshot({ path: '/tmp/uat-shots/note01-before-save.png', fullPage: true });
  // Save — the submit button inside the note form (avoid the top-nav)
  await p.getByRole('button', { name: /^save|save note|add note|submit|post/i }).last().click().catch(() => {});
  await p.waitForTimeout(5000);
  await p.screenshot({ path: '/tmp/uat-shots/note02-after-save.png', fullPage: true });

  console.log('=== message/note create traffic ===');
  console.log(JSON.stringify(reqs, null, 1));
  // did the note appear?
  const t = await p.locator('body').innerText();
  console.log('note appears in list:', /messageCreate regression check/i.test(t));
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
