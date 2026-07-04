/* READ-ONLY: full-page screenshots of the consumer funnel for visual inspection.
 * No searches/submits. Desktop + mobile viewport for the homepage + key funnel pages.
 * Usage: node scripts/smoke-consumer-shots.js
 */
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE || 'https://www.idlookup.ai';
const SHOTS = [
  { route: '/', name: 'home' },
  { route: '/name/landing', name: 'name-landing' },
  { route: '/phone/landing', name: 'phone-landing' },
  { route: '/email/landing', name: 'email-landing' },
  { route: '/search/all', name: 'general-search' },
  { route: '/signup', name: 'signup' },
  { route: '/payment', name: 'payment' },
  { route: '/login', name: 'login' },
  { route: '/contact', name: 'contact' },
];

(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ w: 1280, h: 900, tag: 'desktop' }, { w: 390, h: 844, tag: 'mobile' }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    for (const s of SHOTS) {
      // mobile: only homepage + name-landing + signup (keep it light)
      if (vp.tag === 'mobile' && !['home', 'name-landing', 'signup'].includes(s.name)) continue;
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + s.route, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `/tmp/shot-${s.name}-${vp.tag}.png`, fullPage: true });
        console.log(`ok ${s.name}-${vp.tag}`);
      } catch (e) { console.log(`ERR ${s.name}-${vp.tag}: ${String(e.message).slice(0, 80)}`); }
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
