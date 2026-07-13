import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true });
const p = await b.newPage();
try {
  await p.goto('https://www.idlookup.ai/', { waitUntil: 'domcontentloaded', timeout: 25000 });
  await p.waitForFunction(() => !!window.ApiWrapper, { timeout: 20000 });
  const r = await p.evaluate(async () => {
    const w = window.ApiWrapper.getInstance({ endpointUrl: '/api' });
    const res = await w.api.idLookup.searchTeaser({ type:'name', fName:'John', lName:'Smith', state:'CA', contextKey:'sale.name.teaser' });
    const d = res && res.getData ? res.getData() : res;
    const t = (d && d.commerceContent && d.commerceContent.raws && d.commerceContent.raws[0] && d.commerceContent.raws[0].transient) || {};
    return { count: (t.identities||[]).length, total: t.total, failed: res && res.getFailedCode ? res.getFailedCode() : null };
  });
  console.log('PROBE OK', JSON.stringify(r));
} catch(e) { console.log('PROBE FAIL:', String(e.message).slice(0,160)); }
await b.close();
