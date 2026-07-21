// Combined social-presence enrichment ("start with what we have", 2026-07-21). ENRICH not discover: given
// a RESOLVED person (email and/or name+city), return their public social profiles with a confidence tier.
// Layers: PDL (rich seed — FB/Twitter/LinkedIn/… from email or name+locality) + Gravatar (opt-in, high-conf
// name/photo/verified accounts). Server-side (no browser CORS, keys stay server-side).
//
// ⚠️ LEGAL WATCH-ITEMS (experimenting — flagged, not blocking):
//  1. PDL's terms bar PRODUCTION people-search / FCRA-eligibility use. Fine for eval + INTERNAL enrichment;
//     public DISPLAY of PDL-sourced profiles needs terms clearance OR an FCRA-clean vendor (Spokeo/Pipl).
//     Gravatar data (opt-in/public) carries no such restriction → safe to display.
//  2. Displaying a person's social profiles = accuracy/defamation + CCPA opt-out + FCRA (don't market for
//     screening) obligations, same as our other record surfaces. Honor opt-out; label confidence.
//  3. Do NOT generate faceprints from photos (BIPA). Showing a self-hosted avatar URL is fine; face-matching is not.
import { socialFootprint } from './socialFootprint.mjs';
import { tryConsumePdl, recordPdlMatch } from './pdlBudget.mjs';

const PDL_KEY = process.env.PDL_API_KEY;
const normName = (s) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Defunct / low-value networks to drop (PDL returns historical ones).
const DEAD = new Set(['google', 'googleplus', 'gplus', 'plus.google', 'myspace', 'foursquare', 'friendster',
  'orkut', 'vine', 'aim', 'klout', 'bebo', 'hi5', 'yahoo', 'flickr']);
// Normalize network aliases.
const NET = (n) => {
  const s = String(n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s === 'x' || s === 'twitter') return 'twitter';
  if (s.startsWith('linkedin')) return 'linkedin';
  if (s.startsWith('facebook') || s === 'fb') return 'facebook';
  if (s.startsWith('instagram') || s === 'ig') return 'instagram';
  if (s === 'aboutme') return 'about.me';
  return s;
};

// State abbrev → full name (PDL's `region` wants the full state name).
const STATE_NAME = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' };
const regionOf = (state) => { const s = String(state || '').trim(); return s.length === 2 ? (STATE_NAME[s.toUpperCase()] || s) : s; };

async function pdlEnrich({ email, name, city, state }) {
  if (!PDL_KEY) return null;
  // Permissive floor to get a match; the caller gates on the returned `likelihood` (email = high-confidence
  // key; name+region = weaker → display should require a higher likelihood before asserting it's the person).
  const params = { min_likelihood: '2' };
  if (email) params.email = email;
  else if (name) { params.name = name; if (city) params.locality = city; if (state) params.region = regionOf(state); }
  else return null;
  // Usage tracking + optional daily cap (owner: track spend, control it). Over cap → skip PDL, degrade to Gravatar.
  if (!(await tryConsumePdl())) return null;
  try {
    const r = await fetch(`https://api.peopledatalabs.com/v5/person/enrich?${new URLSearchParams(params)}`, { headers: { 'X-Api-Key': PDL_KEY } });
    if (r.status !== 200) return null; // 404 not_found (common name PDL won't guess) / 400 insufficient data → no match
    const j = await r.json();
    const d = j.data || {};
    if (d.full_name) recordPdlMatch(); // billable match — record for cost (fire-and-forget)
    return {
      matched: !!d.full_name, name: d.full_name || null, likelihood: j.likelihood ?? null, key: email ? 'email' : 'name',
      location: Array.isArray(d.location_names) ? d.location_names[0] : (d.location_name || null),
      profiles: (d.profiles || []).map((p) => ({ network: p.network, url: p.url || null, username: p.username || null })),
    };
  } catch { return null; }
}

// Liveness: return TRUE only when a URL is DEFINITIVELY gone (404/410). Everything else — 200, 3xx, 403,
// 429, 999 (LinkedIn), login-walls, timeouts, network errors — is AMBIGUOUS and kept, because the marquee
// platforms block bots and a false "dead" would drop exactly the profiles we want. Conservative by design.
async function isDeadUrl(url) {
  if (!url) return false;
  const u = /^https?:\/\//.test(url) ? url : `https://${url}`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);
    let r;
    try {
      r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; idlookup/1.0)' } });
    } catch { clearTimeout(t); return false; } // network/timeout → ambiguous → keep
    clearTimeout(t);
    if (r.status === 405 || r.status === 501) return false; // HEAD unsupported → don't judge
    return r.status === 404 || r.status === 410;
  } catch { return false; }
}

/**
 * @param {{email?,name?,city?,state?,expectedName?,verify?}} q  verify=true → drop definitively-dead (404/410) URLs
 * @returns {{ matched, name, photoUrl, nameCorroborated, profiles:Array<{network,url,username,confidence,sources}>, sources:string[] }}
 */
export async function getSocialPresence({ email, name, city, state, expectedName, verify = false } = {}) {
  const expected = expectedName || name || null;
  const [pdl, grav] = await Promise.all([
    pdlEnrich({ email, name, city, state }),
    email ? socialFootprint({ email, expectedName: expected }) : Promise.resolve(null),
  ]);

  const byNet = new Map();
  const add = (network, url, username, source, verified) => {
    const key = NET(network);
    if (!key || DEAD.has(key)) return;
    const e = byNet.get(key) || { network: key, url: null, username: null, sources: new Set(), verified: false };
    e.sources.add(source);
    if (url && !e.url) e.url = url;
    if (username && !e.username) e.username = username;
    if (verified) e.verified = true;
    byNet.set(key, e);
  };
  if (pdl?.profiles) for (const p of pdl.profiles) add(p.network, p.url, p.username, 'pdl');
  if (grav?.accounts) for (const a of grav.accounts) add(a.network, a.url, null, 'gravatar', a.confidence === 'confirmed');

  let profiles = [...byNet.values()]
    .map((e) => ({
      network: e.network, url: e.url, username: e.username,
      // confirmed = self-declared (Gravatar verified) OR corroborated across ≥2 sources; else reported (single seed)
      confidence: (e.verified || e.sources.size >= 2) ? 'confirmed' : 'reported',
      sources: [...e.sources],
    }))
    .sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === 'confirmed' ? -1 : 1));

  // Liveness (report/display surfaces): drop only DEFINITIVELY-dead (404/410) URLs; keep bot-blocked ones.
  if (verify && profiles.length) {
    const dead = await Promise.all(profiles.map((p) => isDeadUrl(p.url)));
    profiles = profiles.filter((_, i) => !dead[i]);
  }

  const sources = [pdl?.matched ? 'pdl' : null, grav?.found ? 'gravatar' : null].filter(Boolean);

  // Overall match confidence for DISPLAY gating — the name-key SERP teaser must not tease a WRONG match.
  // Likelihood is unreliable (low even when correct), so corroborate on the NAME + a profile-count floor:
  //   high   = email key OR Gravatar hit (strong keys)
  //   medium = name key, PDL's returned name corroborates the searched name, AND ≥2 profiles
  //   low    = name key, weak (single profile or name mismatch) → gate OFF the teaser
  const searched = normName(expectedName || name || '');
  const returned = normName(pdl?.name || '');
  const nameMatches = !!(searched && returned && searched.split(' ').filter(Boolean).every((t) => returned.includes(t)));
  let confidence = 'low';
  if (pdl?.key === 'email' || grav?.found) confidence = 'high';
  else if (pdl?.matched && nameMatches && profiles.length >= 2) confidence = 'medium';

  return {
    matched: !!(pdl?.matched || grav?.found),
    name: grav?.name || pdl?.name || null,
    photoUrl: grav?.photoUrl || null,      // only Gravatar (self-hosted, display-safe); no faceprinting
    nameCorroborated: !!grav?.nameCorroborated,
    confidence, nameMatches,
    // Match confidence for the DISPLAY gate: email key = strong; name+region = weaker (require higher
    // likelihood before asserting "this is them" to avoid false attribution / defamation on common names).
    matchKey: pdl?.key || (grav?.found ? 'email' : null),
    matchLikelihood: pdl?.likelihood ?? null,   // PDL 1–10 (null when only Gravatar)
    matchLocation: pdl?.location || null,
    profiles,
    sources,
  };
}
