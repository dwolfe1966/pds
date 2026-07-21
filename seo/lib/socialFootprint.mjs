// Social-presence enrichment — FREE / first-party layer ("start with what we have", 2026-07-21).
// ENRICH not discover: takes a resolved person's EMAIL and returns their public social footprint. Runs
// server-side (no browser CORS; no API keys). Gravatar is the anchor — it's opt-in/self-declared, so a
// hit is HIGH confidence (the person made it) and often carries a photo + VERIFIED linked social accounts.
// Structured so paid seeds (Spokeo/Pipl) and more free checks slot in later behind the same shape.
//
// Confidence tiers on each account:
//   'confirmed'  — self-declared/verified by the subject (Gravatar verified account, or name corroborated)
//   'candidate'  — exists but not tied to this specific person (needs a 2nd signal) [future: enumeration]
import crypto from 'node:crypto';

const md5 = (s) => crypto.createHash('md5').update(String(s || '').trim().toLowerCase()).digest('hex');
const clean = (s) => (s == null ? '' : String(s).trim());
const normName = (s) => clean(s).toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();

/** Gravatar profile for an email (legacy JSON endpoint — no key). Returns null when no profile exists. */
async function gravatar(email) {
  const hash = md5(email);
  let res;
  try {
    res = await fetch(`https://gravatar.com/${hash}.json`, { headers: { 'User-Agent': 'idlookup-social/1.0' } });
  } catch { return null; }
  if (res.status !== 200) return null;
  const j = await res.json().catch(() => null);
  const e = j && j.entry && j.entry[0];
  if (!e) return null;
  return {
    displayName: clean(e.displayName) || null,
    photoUrl: clean(e.thumbnailUrl) || (e.photos && e.photos[0] && clean(e.photos[0].value)) || null,
    location: clean(e.currentLocation) || null,
    // verified linked social accounts (person self-linked these → confirmed)
    accounts: (e.accounts || []).map((a) => ({ network: clean(a.shortname) || clean(a.name), url: clean(a.url), verified: a.verified === 'true' || a.verified === true })).filter((a) => a.url),
    links: (e.urls || []).map((u) => clean(u.value)).filter(Boolean),
    profileUrl: clean(e.profileUrl) || `https://gravatar.com/${hash}`,
  };
}

/**
 * Social footprint for a resolved person. `expectedName` (the person we resolved) lets us CORROBORATE:
 * a Gravatar displayName that matches the resolved name promotes the hit to 'confirmed'.
 * @returns {{ email, found, name, photoUrl, accounts:Array<{network,url,confidence}>, gravatarUrl, sources:string[] }}
 */
export async function socialFootprint({ email, expectedName } = {}) {
  const out = { email: clean(email) || null, found: false, name: null, photoUrl: null, accounts: [], gravatarUrl: null, sources: [] };
  if (!out.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) return out;

  const g = await gravatar(out.email);
  if (g) {
    out.found = true;
    out.sources.push('gravatar');
    out.name = g.displayName;
    out.photoUrl = g.photoUrl;
    out.gravatarUrl = g.profileUrl;
    // Name corroboration: does Gravatar's self-declared name match who we resolved?
    const nameMatch = expectedName && g.displayName && normName(expectedName) && normName(g.displayName).includes(normName(expectedName).split(' ').pop()) && normName(g.displayName).split(' ')[0] === normName(expectedName).split(' ')[0];
    // Gravatar itself is a confirmed profile (opt-in). Its verified linked accounts are confirmed too.
    out.accounts.push({ network: 'gravatar', url: g.profileUrl, confidence: 'confirmed' });
    for (const a of g.accounts) out.accounts.push({ network: a.network, url: a.url, confidence: a.verified ? 'confirmed' : 'candidate' });
    for (const l of g.links) out.accounts.push({ network: 'link', url: l, confidence: nameMatch ? 'confirmed' : 'candidate' });
    out.nameCorroborated = !!nameMatch;
  }
  return out;
}
