import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'] });
const ctx = await b.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 800 }, locale: 'en-US',
});
await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
const p = await ctx.newPage();
try {
  await p.goto('https://www.idlookup.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const gotWrapper = await p.waitForFunction(() => !!window.ApiWrapper, { timeout: 20000 }).then(() => true).catch(() => false);
  if (!gotWrapper) { console.log('RESULT: page loaded but ApiWrapper never appeared (Turnstile interstitial)'); await b.close(); process.exit(0); }
  const r = await p.evaluate(async () => {
    const w = window.ApiWrapper.getInstance({ endpointUrl: '/api' });
    const res = await w.api.idLookup.searchTeaser({ type:'name', fName:'John', lName:'Smith', state:'CA', contextKey:'sale.name.teaser' });
    const d = res && res.getData ? res.getData() : res;
    const t = (d && d.commerceContent && d.commerceContent.raws && d.commerceContent.raws[0] && d.commerceContent.raws[0].transient) || {};
    return { failed: res && res.getFailedCode ? res.getFailedCode() : null, count: (t.identities||[]).length, total: t.total };
  });
  console.log('RESULT:', JSON.stringify(r));
} catch (e) { console.log('RESULT FAIL:', String(e.message).slice(0,120)); }
await b.close();
