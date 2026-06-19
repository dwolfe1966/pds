const { chromium } = require('@playwright/test');
const BASE = 'http://localhost:3000';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  p.setDefaultTimeout(25000);
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  const out = await p.evaluate(async () => {
    if (!window.ApiWrapper) return { err: 'no ApiWrapper' };
    const a = window.ApiWrapper.getInstance ? window.ApiWrapper.getInstance({ endpointUrl: '/api' }) : window.ApiWrapper;
    const call = async (shmName) => { try { const r = await a.api.offer.findByShmName.call(a.api.offer, { shmName }); const d = r?.getData?r.getData():r; const e = r?.getError?r.getError():null; return { err: e?.response?.data?.message||e?.message||null, hasPrice: !!(d?.transient?.priceInfo), s0: d?.transient?.priceInfo?.s0, keys: d&&typeof d==='object'?Object.keys(d).slice(0,6):typeof d }; } catch(e){ return { thrown: e.message }; } };
    return { signup_main: await call('comp.offer.signup.main'), agent_retention: await call('comp.offer.agent.retention') };
  });
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
