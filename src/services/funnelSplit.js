/**
 * v11 (BeenVerified-style) A/B split — owner decisions 2026-07-11.
 *
 *   • PAID traffic — ONLY the v3 (inmate) family. 50% → v11; the other 50% KEEP the
 *     route the campaign already resolved to (v3 / v3a / v3b). This PRESERVES the
 *     existing BC-theme v3a/v3b A/B for the non-v11 half — it does NOT overwrite it.
 *   • SEO traffic — tagged (?utm_source=seo / ?seo=1) OR referrer=idlookup.me. 50% →
 *     v11, 50% → v2. Untagged/direct organic is left alone (homepage, unchanged).
 *   • 50/50, sticky per visitor (sessionStorage stores the DECISION, not the route, so
 *     a re-render under a different theme arm still keeps the right side).
 *
 * The chosen arm is a real landing route, so the funnel variant is captured naturally
 * by that landing's useLandingTrack (v11-serp / v3* / v2).
 *
 * NOT WIRED YET. This is a standalone helper — wiring it into the homepage redirect
 * (App.js `HomePageRedirect`) is a separate, confirmed step. Two things to resolve
 * before wiring: (a) confirm the paid split = "50% v11 / 50% existing v3a-v3b A/B";
 * (b) where does idlookup.me link to — `/` (this helper catches it) or `/search`
 * (the SEO split must move there instead)?
 */

const V11 = '/name/landing/v11';
const V2 = '/name/landing/v2';
const V3_FAMILY = ['/name/landing/v3', '/name/landing/v3a', '/name/landing/v3b'];

/** Tagged SEO traffic or an idlookup.me referrer. */
export function isSeoTraffic(search) {
  try {
    const p = new URLSearchParams(search || '');
    if ((p.get('utm_source') || '').toLowerCase() === 'seo') return true;
    if (p.get('seo') === '1') return true;
    const ref = (typeof document !== 'undefined' && document.referrer) || '';
    if (ref) {
      const host = new URL(ref).hostname || '';
      if (/(^|\.)idlookup\.me$/i.test(host)) return true;
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * Sticky 50/50: v11 vs "keep the current route". Stores the DECISION under `key` so a
 * later render under a different theme arm still returns the right side.
 */
function pickV11OrKeep(keepRoute, key) {
  try {
    const prev = sessionStorage.getItem(key);
    if (prev === 'v11') return V11;
    if (prev === 'keep') return keepRoute;
  } catch { /* ignore */ }
  const toV11 = Math.random() < 0.5;
  try { sessionStorage.setItem(key, toV11 ? 'v11' : 'keep'); } catch { /* ignore */ }
  return toV11 ? V11 : keepRoute;
}

/**
 * Resolve the split landing route, or null if this visitor isn't in a split segment.
 * @param {string|null} campaignRoute  the campaign's RESOLVED landing route (v3a/v3b for
 *                                      inmate traffic once the BC theme has settled)
 * @param {string} search              location.search
 */
export function resolveSplitRoute(campaignRoute, search) {
  // Paid: v3-family (inmate). 50% v11, 50% keep the resolved v3/v3a/v3b arm.
  if (campaignRoute && V3_FAMILY.includes(campaignRoute)) {
    return pickV11OrKeep(campaignRoute, 'split.paidv3');
  }
  // SEO: tagged or idlookup.me-referred. 50% v11, 50% v2.
  if (isSeoTraffic(search)) {
    return pickV11OrKeep(V2, 'split.seo');
  }
  return null;
}
