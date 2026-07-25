// HIBP email-exposure lookup for the "is your email exposed?" flow (E3). Key stays server-side (HIBP_API_KEY,
// Core 1 tier is plenty — every tier returns identical data; you only buy req/min up the ladder). Cache-first
// (see emailExposureDb) to stay well under the 10 req/min limit. SELF-CHECK use (the visitor's own email) —
// HIBP's blessed Core "direct email search."
//
// Returns { available:false, ... } (never throws) when the key is unset or HIBP errors/ rate-limits, so the
// funnel degrades to a plain "check your identity exposure" CTA.
import { getCachedExposure, setCachedExposure } from './emailExposureDb.mjs';

const HIBP_BASE = 'https://haveibeenpwned.com/api/v3/breachedaccount';
const EMPTY = { available: false, breached: false, count: 0, breaches: [], topDataClasses: [], mostRecent: null };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Rank the scariest exposed data types first for the teaser summary.
const CLASS_WEIGHT = { Passwords: 100, 'Password hints': 60, 'Credit cards': 95, 'Bank account numbers': 95, 'Social security numbers': 98, 'Phone numbers': 70, 'Physical addresses': 65, 'Partial credit card data': 80, 'Security questions and answers': 75, 'Historical passwords': 85 };

function summarize(breaches) {
  const list = (Array.isArray(breaches) ? breaches : []).map((b) => ({
    name: b.Title || b.Name || 'Unknown',
    date: b.BreachDate || null,
    classes: Array.isArray(b.DataClasses) ? b.DataClasses : [],
  }));
  // Aggregate + rank exposed data classes across all breaches.
  const seen = new Map();
  for (const b of list) for (const c of b.classes) seen.set(c, (seen.get(c) || 0) + 1);
  const topDataClasses = [...seen.keys()].sort((a, z) => (CLASS_WEIGHT[z] || 10) - (CLASS_WEIGHT[a] || 10));
  const mostRecent = list.map((b) => b.date).filter(Boolean).sort().pop() || null;
  return { available: true, breached: list.length > 0, count: list.length, breaches: list, topDataClasses, mostRecent };
}

export async function getEmailExposure({ email, forceRefresh = false } = {}) {
  const key = process.env.HIBP_API_KEY;
  const em = String(email || '').trim().toLowerCase();
  if (!key || !EMAIL_RE.test(em)) return EMPTY;

  // forceRefresh (the monitoring cron) bypasses cache reuse to catch NEW breaches; the result still
  // gets written back to the cache below, so the on-demand path stays free.
  if (!forceRefresh) {
    const cached = await getCachedExposure(em);
    if (cached) return cached;
  }

  try {
    const res = await fetch(`${HIBP_BASE}/${encodeURIComponent(em)}?truncateResponse=false`, {
      headers: { 'hibp-api-key': key, 'user-agent': 'IDLookup-EmailExposure' },
    });
    if (res.status === 404) {
      const clean = { available: true, breached: false, count: 0, breaches: [], topDataClasses: [], mostRecent: null };
      await setCachedExposure(em, clean);
      return clean;
    }
    if (!res.ok) return EMPTY; // 401/429/5xx → degrade (don't cache a non-answer)
    const data = await res.json();
    const result = summarize(data);
    await setCachedExposure(em, result);
    return result;
  } catch {
    return EMPTY;
  }
}
