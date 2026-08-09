// Browsing-history store for the IDLookup extension (owner decision 2026-08-08: raw history to backend WITH
// upfront global consent + full delete/remove control). GATED: nothing is stored unless the user has an
// on-record consent, and the user can wipe everything at any time (deleteUserHistory). App-key gated at the
// route. ⚠️ Because this holds sensitive browsing data, it MUST ship with a prominent disclosure + privacy
// policy (Chrome Web Store "Limited Use") and encrypted-at-rest storage (Neon default) before go-live.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasHistoryDb = !!URL;
const sql = hasHistoryDb ? neon(URL) : null;

const MAX_PER_REQUEST = 1000; // cap batch size

let _ensured = false;
async function ensure() {
  if (_ensured || !sql) return;
  await sql`CREATE TABLE IF NOT EXISTS history_consent (
    user_id TEXT PRIMARY KEY, consented BOOLEAN NOT NULL DEFAULT false,
    consent_version TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS browsing_history (
    id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, url TEXT NOT NULL, title TEXT, host TEXT,
    visited_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bh_user ON browsing_history(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_bh_user_host ON browsing_history(user_id, host)`;
  _ensured = true;
}

export async function recordConsent(userId, consented, version) {
  if (!sql || !userId) return;
  await ensure();
  await sql`INSERT INTO history_consent (user_id, consented, consent_version, updated_at)
    VALUES (${userId}, ${!!consented}, ${version || null}, now())
    ON CONFLICT (user_id) DO UPDATE SET consented = ${!!consented}, consent_version = ${version || null}, updated_at = now()`;
}

export async function hasConsent(userId) {
  if (!sql || !userId) return false;
  await ensure();
  try { const r = await sql`SELECT consented FROM history_consent WHERE user_id = ${userId}`; return !!(r[0] && r[0].consented); }
  catch { return false; }
}

// Store a batch of visits. Requires an on-record consent — no consent, nothing stored (defense in depth).
export async function insertVisits(userId, visits) {
  if (!sql || !userId || !Array.isArray(visits) || !visits.length) return { stored: 0 };
  await ensure();
  if (!(await hasConsent(userId))) return { stored: 0, error: 'no_consent' };
  const rows = visits.slice(0, MAX_PER_REQUEST).map((v) => {
    let host = null; try { host = new URL(v.url).host; } catch { /* skip bad url */ }
    return { url: String(v.url || '').slice(0, 2048), title: v.title ? String(v.title).slice(0, 512) : null, host, visited_at: v.visitedAt ? new Date(v.visitedAt) : null };
  }).filter((r) => r.url && r.host);
  let stored = 0;
  for (const r of rows) {
    try { await sql`INSERT INTO browsing_history (user_id, url, title, host, visited_at) VALUES (${userId}, ${r.url}, ${r.title}, ${r.host}, ${r.visited_at})`; stored++; }
    catch { /* skip */ }
  }
  return { stored };
}

// FULL delete — wipe every stored visit for the user AND turn consent off (their "remove & delete" control).
export async function deleteUserHistory(userId) {
  if (!sql || !userId) return { deleted: 0 };
  await ensure();
  const del = await sql`DELETE FROM browsing_history WHERE user_id = ${userId}`;
  await sql`UPDATE history_consent SET consented = false, updated_at = now() WHERE user_id = ${userId}`;
  return { deleted: (del && del.count) || 0 };
}

// Host → signal map for turning raw history into HONEST insight. We only assert what's true: a host is a
// known data broker (opt-out available), a social profile (feeds people-search), or was in a widely-reported
// public breach. "You visited X" is a fact; we never claim "your data is listed there." sourceKey ties a
// broker match to the footprint catalog so the client can open its opt-out guide.
const HOST_SIGNALS = {
  // People-search / data brokers (sourceKey matches source_registry)
  'spokeo.com': { kind: 'broker', name: 'Spokeo', sourceKey: 'spokeo' },
  'whitepages.com': { kind: 'broker', name: 'Whitepages', sourceKey: 'whitepages' },
  'beenverified.com': { kind: 'broker', name: 'BeenVerified', sourceKey: 'beenverified' },
  'peoplefinders.com': { kind: 'broker', name: 'PeopleFinders', sourceKey: 'peoplefinders' },
  'radaris.com': { kind: 'broker', name: 'Radaris', sourceKey: 'radaris' },
  'mylife.com': { kind: 'broker', name: 'MyLife', sourceKey: 'mylife' },
  'truepeoplesearch.com': { kind: 'broker', name: 'TruePeopleSearch', sourceKey: 'truepeoplesearch' },
  'intelius.com': { kind: 'broker', name: 'Intelius', sourceKey: 'intelius' },
  'truthfinder.com': { kind: 'broker', name: 'TruthFinder', sourceKey: 'truthfinder' },
  'instantcheckmate.com': { kind: 'broker', name: 'Instant Checkmate', sourceKey: 'instantcheckmate' },
  'thatsthem.com': { kind: 'broker', name: "That'sThem", sourceKey: 'thatsthem' },
  'peekyou.com': { kind: 'broker', name: 'PeekYou', sourceKey: 'peekyou' },
  // Social profiles (feed people-search; common breach targets)
  'linkedin.com': { kind: 'social', name: 'LinkedIn' },
  'facebook.com': { kind: 'social', name: 'Facebook' },
  'instagram.com': { kind: 'social', name: 'Instagram' },
  'twitter.com': { kind: 'social', name: 'X / Twitter' },
  'x.com': { kind: 'social', name: 'X / Twitter' },
  'tiktok.com': { kind: 'social', name: 'TikTok' },
  'reddit.com': { kind: 'social', name: 'Reddit' },
  // Widely-reported public breaches (well-documented — advise password hygiene, not a per-account claim)
  'adobe.com': { kind: 'breach', name: 'Adobe', year: 2013 },
  'dropbox.com': { kind: 'breach', name: 'Dropbox', year: 2012 },
  'canva.com': { kind: 'breach', name: 'Canva', year: 2019 },
  'myfitnesspal.com': { kind: 'breach', name: 'MyFitnessPal', year: 2018 },
  'lastpass.com': { kind: 'breach', name: 'LastPass', year: 2022 },
  'yahoo.com': { kind: 'breach', name: 'Yahoo', year: 2013 },
  'ticketmaster.com': { kind: 'breach', name: 'Ticketmaster', year: 2024 },
};

// Turn stored history into insight: which of the sites the member ACTUALLY visits are data brokers (opt-out),
// social profiles, or known-breach sites. Honest — states "you visited", never "you're listed there".
export async function historyInsights(userId) {
  if (!sql || !userId) return { totalVisits: 0, uniqueHosts: 0, brokers: [], socials: [], breaches: [] };
  await ensure();
  const s = await historySummary(userId);
  const norm = (h) => String(h || '').toLowerCase().replace(/^www\./, '');
  const match = (host) => {
    const h = norm(host);
    for (const key of Object.keys(HOST_SIGNALS)) if (h === key || h.endsWith('.' + key)) return HOST_SIGNALS[key];
    return null;
  };
  const brokers = [], socials = [], breaches = [];
  const seen = new Set();
  for (const row of s.topHosts || []) {
    const sig = match(row.host); if (!sig) continue;
    const key = sig.sourceKey || sig.name;
    if (seen.has(key)) continue; seen.add(key);
    const item = { name: sig.name, host: norm(row.host), visits: row.n, sourceKey: sig.sourceKey || null, year: sig.year || null };
    if (sig.kind === 'broker') brokers.push(item);
    else if (sig.kind === 'social') socials.push(item);
    else if (sig.kind === 'breach') breaches.push(item);
  }
  return { totalVisits: s.total, uniqueHosts: (s.topHosts || []).length, brokers, socials, breaches };
}

// Aggregated view for insights (host counts) — never raw rows off the box beyond the user's own device.
export async function historySummary(userId) {
  if (!sql || !userId) return { total: 0, topHosts: [] };
  await ensure();
  try {
    const total = await sql`SELECT count(*)::int AS n FROM browsing_history WHERE user_id = ${userId}`;
    const hosts = await sql`SELECT host, count(*)::int AS n FROM browsing_history WHERE user_id = ${userId} GROUP BY host ORDER BY n DESC LIMIT 50`;
    return { total: (total[0] && total[0].n) || 0, topHosts: hosts };
  } catch { return { total: 0, topHosts: [] }; }
}
