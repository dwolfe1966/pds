/**
 * v11 (BeenVerified-style) A/B split — owner decisions 2026-07-11 (confirmed).
 *
 *   • PAID / internal (inmate v3-family) — OVERRIDE the BC theme: 50% → v3, 50% → v11 (was 75/25; v11 wins on inmate traffic, owner 2026-07-19).
 *     This intentionally DROPS the v3a/v3b theme split (not enough volume for a 4-way).
 *   • SEO / referral (from idlookup.me) — lands directly on /name/landing/v2 with
 *     ?utm_source=idlookup.me. Split 50% → v2, 50% → v11.
 *   • 50/50 & 75/25 are sticky per visitor (sessionStorage stores the chosen route).
 *
 * The chosen arm is a real landing route, so the funnel variant is captured naturally
 * by that landing's useLandingTrack (v11-serp / v3 / v2).
 *
 * Placements (see App.js):
 *   - PAID: `HomePageRedirect` (paid lands on `/?shn=…` → we override the campaign route).
 *   - SEO:  a wrapper on the `/name/landing/v2` route (SEO lands there directly).
 * Deep search-result links (`/name/search-result?firstName=…&utm_source=idlookup.me`)
 * are left as direct results — they carry a person context, so no landing split.
 */

import { setFlow } from './funnelFlow';

const V11 = '/name/landing/v11';
const V2 = '/name/landing/v2';
const V3 = '/name/landing/v3';
const V3_FAMILY = [V3, '/name/landing/v3a', '/name/landing/v3b'];

/** SEO/referral traffic from idlookup.me (tag or referrer). */
export function isSeoTraffic(search) {
  try {
    const p = new URLSearchParams(search || '');
    const src = (p.get('utm_source') || '').toLowerCase();
    if (src === 'idlookup.me' || src === 'seo') return true;
    if (p.get('seo') === '1') return true;
    const ref = (typeof document !== 'undefined' && document.referrer) || '';
    if (ref) {
      const host = new URL(ref).hostname || '';
      if (/(^|\.)idlookup\.me$/i.test(host)) return true;
    }
  } catch { /* ignore */ }
  return false;
}

/** Sticky weighted pick. arms = [[route, weight], …]; weights sum to 1. */
function pickWeighted(arms, key) {
  try {
    const prev = sessionStorage.getItem(key);
    if (prev && arms.some(([r]) => r === prev)) return prev;
  } catch { /* ignore */ }
  const r = Math.random();
  let acc = 0;
  let chosen = arms[arms.length - 1][0];
  for (const [route, w] of arms) { acc += w; if (r < acc) { chosen = route; break; } }
  try { sessionStorage.setItem(key, chosen); } catch { /* ignore */ }
  return chosen;
}

/**
 * PAID override. If the campaign resolved to the v3 (inmate) family, return the split
 * route (50/50 v3/v11), overriding the BC v3a/v3b theme. null = not a paid-v3
 * campaign (leave the campaign's own routing alone).
 */
export function resolvePaidRoute(campaignRoute) {
  if (campaignRoute && V3_FAMILY.includes(campaignRoute)) {
    // The v3 family IS the inmate campaign — tag the session flow so BOTH arms (v3 sets it itself; v11 is
    // otherwise flow-agnostic) know the referral is inmate and can show the booking teaser (owner 2026-07-19).
    setFlow('inmate');
    return pickWeighted([[V3, 0.5], [V11, 0.5]], 'split.paidv3');
  }
  return null;
}

/**
 * SEO landing split for the /name/landing/v2 route. If this is idlookup.me traffic,
 * return the assigned arm (v2 or v11, 50/50). null = not SEO traffic → render v2 as-is.
 */
export function resolveSeoLanding(search) {
  if (!isSeoTraffic(search)) return null;
  return pickWeighted([[V2, 0.5], [V11, 0.5]], 'split.seo');
}
