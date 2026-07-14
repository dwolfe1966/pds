// WSFY ("Who's Searching For You") reverse-join + tiered summary. Given a subscriber's
// identity, find who searched for them and build a FREE (obfuscated tease) or PAID (full
// detail) view. Masking happens HERE, server-side — a free client never receives real names.
//
// Match on stable attributes (normalized name + state), never extId (ephemeral). Data source
// is the Phase-1 corpus (search_activity + search_results). Affinity descriptors that need
// data we don't license yet (e.g. "went to your high school", "just got married") are NOT
// fabricated — we ship the sourceable subset (count, location, one proof name) honestly.
import { neon } from '@neondatabase/serverless';
import { norm } from './search-activity-db.mjs';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasWsfyDb = !!URL;
const sql = hasWsfyDb ? neon(URL) : null;

const TYPE_LABEL = { name: 'Name', phone: 'Phone', email: 'Email', address: 'Address' };

/** "John Smith" → "J••• S••••" (server-side mask for the free tease). */
function maskLabel(name) {
  if (!name) return 'Someone';
  return String(name).trim().split(/\s+/)
    .map((w) => (w ? w[0] + '•'.repeat(Math.max(1, w.length - 1)) : ''))
    .join(' ');
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function plural(n, one, many) { return n === 1 ? one : (many || `${one}s`); }

// Suppression hook (opt-out). Wire to the IDI/index opt-out list in a follow-up; for now
// nothing is suppressed. Kept as a seam so the reveal respects opt-out when it lands.
function isSuppressed(/* row */) { return false; }

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

// Owner (2026-07-14): a search with the EXACT last name + a FUZZY first name counts as a search
// for you. Exact-last is enforced in SQL; this fuzzes the FIRST name — exact, a nickname-style
// prefix (Dave/David, Chris/Christopher), or a small typo distance (Jon/John, Sara/Sarah).
function fuzzyFirst(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 3 && b.startsWith(a)) return true;
  if (b.length >= 3 && a.startsWith(b)) return true;
  return levenshtein(a, b) <= (Math.max(a.length, b.length) <= 4 ? 1 : 2);
}

/**
 * @param {object} identity  { name, city, state, selfUserId }
 * @param {object} opts       { tier: 'free'|'paid', limit }
 * @returns {Promise<object>} { count, tier, teaseSummary:{headline,lines[]}, events[] }
 */
export async function buildWsfySummary(identity, opts = {}) {
  if (!sql) throw new Error('no WSFY DB configured');
  const subjNorm = norm(`${identity.name || ''}`);
  const paid = opts.tier === 'paid';
  if (!subjNorm) return { count: 0, tier: paid ? 'paid' : 'free', teaseSummary: { headline: 'No search activity yet', lines: [] }, events: [] };

  // Split subject → exact last + fuzzy first. `lastKey` null (no last name) disables the
  // term-last branch so we fall back to result-matches only.
  const parts = subjNorm.split(' ');
  const subjFirst = parts[0] || '';
  const subjLast = parts.length > 1 ? parts[parts.length - 1] : '';
  const lastKey = subjLast || null;

  const state = identity.state ? String(identity.state).trim().toUpperCase() : null;
  const selfUserId = identity.selfUserId || null;

  // Candidate rows: same LAST name typed (fuzzy first is filtered in JS below) OR the subject
  // appeared in a result set (exact). Self-searches excluded. Aggregated in JS after the fuzzy
  // filter (can't GROUP BY before fuzzing). LIMIT is a safety cap on same-surname volume.
  const rows = await sql`
    SELECT sa.id, sa.searcher_type, sa.searcher_user_id, sa.session_id, sa.searcher_name_norm,
           sa.searcher_name, sa.searcher_first, sa.searcher_city, sa.searcher_state,
           sa.term_first, sa.term_last, sa.search_type, sa.received_at,
           COALESCE(sa.searcher_user_id, sa.session_id, sa.searcher_name_norm, sa.id::text) AS searcher_key,
           EXISTS (SELECT 1 FROM search_results sr WHERE sr.activity_id = sa.id AND sr.name_norm = ${subjNorm}
                   AND (${state}::text IS NULL OR sr.state = ${state} OR sr.state IS NULL)) AS result_match
    FROM search_activity sa
    WHERE (
            (${lastKey}::text IS NOT NULL AND sa.term_last = ${lastKey}
               AND (${state}::text IS NULL OR sa.term_state = ${state} OR sa.term_state IS NULL))
            OR EXISTS (SELECT 1 FROM search_results sr WHERE sr.activity_id = sa.id AND sr.name_norm = ${subjNorm}
                       AND (${state}::text IS NULL OR sr.state = ${state} OR sr.state IS NULL))
          )
      AND (${selfUserId}::text IS NULL OR sa.searcher_user_id IS DISTINCT FROM ${selfUserId})
      AND (sa.searcher_name_norm IS DISTINCT FROM ${subjNorm})
    ORDER BY sa.received_at DESC
    LIMIT 4000
  `;

  // Fuzzy-first filter: keep result-matches (exact) + same-last rows whose first name fuzzy-matches.
  const matched = rows.filter((r) => r.result_match || fuzzyFirst(r.term_first, subjFirst));

  // Aggregate per distinct searcher.
  const byKey = new Map();
  for (const r of matched) {
    if (isSuppressed(r)) continue;
    let g = byKey.get(r.searcher_key);
    if (!g) {
      g = {
        searcher_key: r.searcher_key, searcher_name: r.searcher_name, searcher_first: r.searcher_first,
        searcher_city: r.searcher_city, searcher_state: r.searcher_state,
        is_member: r.searcher_type === 'member', times: 0, last_at: r.received_at, last_type: r.search_type,
      };
      byKey.set(r.searcher_key, g);
    }
    g.times += 1;
    if (r.received_at > g.last_at) { g.last_at = r.received_at; g.last_type = r.search_type; }
    if (!g.searcher_name && r.searcher_name) { g.searcher_name = r.searcher_name; g.searcher_first = r.searcher_first; }
    if (!g.searcher_city && r.searcher_city) g.searcher_city = r.searcher_city;
    if (r.searcher_type === 'member') g.is_member = true;
  }
  const limit = Math.min(opts.limit || 200, 500);
  const visible = Array.from(byKey.values())
    .sort((a, b) => (a.last_at < b.last_at ? 1 : a.last_at > b.last_at ? -1 : 0))
    .slice(0, limit);
  const count = visible.length;

  // ── Events list (for the page's table + charts) — tiered ─────────────────
  const events = visible.map((r, i) => {
    const isMember = !!r.is_member;
    const tier = isMember ? 'Basic' : 'Visitor';
    const searchType = TYPE_LABEL[r.last_type] || cap(r.last_type) || 'Name';
    const base = { id: String(r.searcher_key || i), timestamp: r.last_at, searchType, tier, times: r.times };
    if (paid) {
      return {
        ...base,
        name: r.searcher_name || (isMember ? 'Member' : 'Anonymous visitor'),
        firstName: r.searcher_first || (r.searcher_name ? r.searcher_name[0] : ''),
        city: r.searcher_city || '',
        state: r.searcher_state || '',
      };
    }
    // FREE: no real name/city leaves the server; coarse state only.
    return { ...base, name: maskLabel(r.searcher_name), firstName: '', city: '', state: r.searcher_state || '' };
  });

  // ── Tease summary (the conversion hook — your "4 people…" line) ──────────
  const headline = count === 0
    ? 'No one has searched for you yet'
    : `${count} ${plural(count, 'person', 'people')} ${plural(count, 'is', 'are')} searching for you`;
  const lines = [];

  // Location descriptors from searchers with a known city (top 2 cities).
  const cityCounts = {};
  for (const r of visible) {
    if (r.searcher_city) cityCounts[r.searcher_city] = (cityCounts[r.searcher_city] || 0) + 1;
  }
  const topCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 2);
  for (const [city, c] of topCities) {
    lines.push(`${c} who ${plural(c, 'lives', 'live')} in ${city}`);
  }

  // One "proof" name — a real member searcher, revealed to prove the activity is real.
  const proof = visible.find((r) => r.is_member && r.searcher_name);
  if (proof) lines.push(proof.searcher_name);

  // Remainder.
  const accounted = topCities.reduce((s, [, c]) => s + c, 0) + (proof ? 1 : 0);
  const remainder = count - accounted;
  if (remainder > 0) lines.push(`and ${remainder} more`);

  return { count, tier: paid ? 'paid' : 'free', teaseSummary: { headline, lines }, events };
}
