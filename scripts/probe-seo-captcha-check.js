/* DEV-ONLY diagnostic: find which captcha password BC dev /captcha/verify accepts,
 * then run one teaser end-to-end via direct fetch (replicating the IIFE flow). READ-ONLY. */
const { chromium } = require('@playwright/test');
const BASE = 'https://dev.www.idlookup.ai';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 45000 });
  const out = await p.evaluate(async () => {
    const rnd = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
    const cands = ['bcEdgeApiPass', 'bcEdgeApiPass123!@#', 'bcedgeapipass'];
    const log = [];
    // 1) trigger 412 to get a captchaId
    const cid = rnd(), aid = rnd();
    const url = `/api/idLookup/teaser/search?clientId=${cid}&apiId=${aid}`;
    const body = JSON.stringify({ fName: 'John', lName: 'Smith', state: 'TX', type: 'name', contextKey: 'sale.name.teaser' });
    let r = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body });
    let j = await r.json().catch(() => ({}));
    log.push('teaser1 ' + r.status + ' ' + JSON.stringify(j).slice(0, 120));
    if (r.status !== 412 || !j.captchaId) return { log, note: 'no captcha challenge' };
    const captchaId = j.captchaId, step = j.step || '0-0';
    // 2) try each password against /captcha/verify
    for (const pw of cands) {
      const vr = await fetch(`/api/captcha/verify?token=${encodeURIComponent(pw)}&type=password.v0&step=${step}&clientId=${cid}&apiId=${aid}`,
        { method: 'GET', credentials: 'include', headers: { 'x-captcha-id': captchaId } });
      const vt = await vr.text();
      log.push(`verify "${pw}" -> ${vr.status} ${vt.slice(0, 100)}`);
      if (vr.ok) {
        // 3) retry teaser with x-captcha-id header — try same URL, and a fresh-apiId URL
        const aid2 = rnd();
        const url2 = `/api/idLookup/teaser/search?clientId=${cid}&apiId=${aid2}`;
        let r2 = await fetch(url2, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'x-captcha-id': captchaId }, body });
        let t2 = await r2.text();
        log.push(`teaser2(freshApiId) ${r2.status} len=${t2.length} ${t2.slice(0,60)}`);
        if (!r2.ok) {
          r2 = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'x-captcha-id': captchaId }, body });
          t2 = await r2.text();
          log.push(`teaser2(sameUrl) ${r2.status} len=${t2.length} ${t2.slice(0,60)}`);
        }
        try {
          const j2 = JSON.parse(t2);
          const tr = (j2.raws || j2.commerceContent?.raws || []).find((x) => x?.transient?.identities)?.transient;
          if (tr) { log.push(`RESULTS total=${tr.total} perPage=${tr.perPage} got=${tr.identities?.length} keys=${Object.keys(tr.identities?.[0]||{}).join(',')}`); }
        } catch (e) { log.push('parse err ' + e.message); }
        break;
      }
    }
    return { log };
  });
  console.log(JSON.stringify(out, null, 2));
  await b.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
