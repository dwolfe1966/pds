/* Discover where BC delivers the per-shN config flags (optout / thinmatch / landing /
 * sup) inside the ShapeCompiled object. READ-ONLY — loads the deployed consumer site
 * with a known shN token and dumps getShapeCompiled() structure + probes candidate
 * comp keys. No creds, no search (so no captcha).
 *   node scripts/probe-shapecompiled.js [shnToken]
 */
const { chromium } = require('@playwright/test');
const SITE = process.env.CONSUMER_SITE || 'https://dev.www.idlookup.ai';
const SHN = process.argv[2] || '6a273f983ee3447608a3aae5'; // Google Inmates Lower (thinmatch:yes)

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(45000);
  const out = { site: SITE, shn: SHN };

  // Intercept the shape/compiled network call the app makes on its own (CampaignContext).
  const shapeResponses = [];
  page.on('response', async (resp) => {
    const u = resp.url();
    if (/shape|compiled/i.test(u)) {
      try { shapeResponses.push({ url: u.slice(0, 120), status: resp.status(), body: (await resp.text()).slice(0, 8000) }); } catch {}
    }
  });

  await page.goto(`${SITE}/?shn=${SHN}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000); // let CampaignContext fire getShapeCompiled
  out.shapeNetworkCalls = shapeResponses;

  // wait for the IIFE + shape API
  await page.waitForFunction(() => window.ApiWrapper, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const result = await page.evaluate(async (shn) => {
    const o = { ok: false };
    try {
      const AW = window.ApiWrapper;
      o.shapeApiMethods = AW?.api?.shape ? Object.keys(AW.api.shape) : null;
      // some builds require setting shParams first; try common setters
      for (const m of ['setInitialShParams', 'setShParams', 'initialShParams']) {
        if (typeof AW?.api?.shape?.[m] === 'function') { try { await AW.api.shape[m]({ shConId: shn }); o.setVia = m; } catch (e) { o.setErr = String(e); } }
      }
      const shape = await AW.api.shape.getShapeCompiled();
      o.ok = true;
      o.typeofShape = typeof shape;
      o.ownKeys = shape && typeof shape === 'object' ? Object.keys(shape) : null;
      o.device = shape?.device; o.requestCity = shape?.requestCity;
      // dump any internal comp collection so we can SEE all available keys
      for (const prop of ['comps', 'components', 'data', '_comps', 'compiled', 'shComps', 'list']) {
        const v = shape?.[prop];
        if (v) {
          o.internalProp = prop;
          try { o.internalSample = JSON.stringify(v).slice(0, 4000); } catch { o.internalSample = '[unstringifiable]'; }
          if (Array.isArray(v)) o.internalKeys = v.map(x => x?.key || x?.name || x?.componentName).filter(Boolean).slice(0, 80);
          else if (typeof v === 'object') o.internalKeys = Object.keys(v).slice(0, 80);
          break;
        }
      }
      // full stringify fallback (strip funcs)
      if (!o.internalKeys) {
        try { o.fullJson = JSON.stringify(shape, (k, val) => typeof val === 'function' ? undefined : val).slice(0, 6000); } catch (e) { o.fullJsonErr = String(e); }
      }
      // probe candidate comp keys for optout / thinmatch / landing / sup
      if (typeof shape?.getShComp === 'function') {
        const candidates = [
          'comp.brand.name','comp.partner.name','comp.connection.name',
          'comp.optout','comp.optOut','comp.opt.out','comp.search.optout','comp.page.optout','comp.detail.optout','comp.signup.optout','comp.offer.optout','comp.connection.optout','comp.collection.optout',
          'comp.thinmatch','comp.thinMatch','comp.search.thinmatch','comp.search.thinMatch','comp.sequence.thinmatch','comp.sequence.thinMatch','comp.page.thinmatch',
          'comp.landing','comp.landing.route','comp.page.landing','comp.connection.landing','comp.collection.landing',
          'comp.sup','comp.search.sup','comp.detail.sup','comp.detail.variant',
        ];
        o.shComp = {};
        for (const k of candidates) { try { const v = shape.getShComp(k); if (v !== undefined && v !== null && v !== '') o.shComp[k] = v; } catch {} }
      }
    } catch (e) { o.error = String(e); }
    return o;
  }, SHN);

  Object.assign(out, result);
  console.log('===== SHAPECOMPILED PROBE =====');
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
})();
