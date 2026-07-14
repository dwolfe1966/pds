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

/**
 * @param {object} identity  { name, city, state, selfUserId }
 * @param {object} opts       { tier: 'free'|'paid', limit }
 * @returns {Promise<object>} { count, tier, teaseSummary:{headline,lines[]}, events[] }
 */
export async function buildWsfySummary(identity, opts = {}) {
  if (!sql) throw new Error('no WSFY DB configured');
  const subjNorm = norm(`${identity.name || ''}`);
  if (!subjNorm) return { count: 0, tier: opts.tier === 'paid' ? 'paid' : 'free', teaseSummary: { headline: 'No search activity yet', lines: [] }, events: [] };

  const state = identity.state ? String(identity.state).trim().toUpperCase() : null;
  const selfUserId = identity.selfUserId || null;
  const paid = opts.tier === 'paid';
  const limit = Math.min(opts.limit || 200, 500);

  // One row per distinct searcher who searched for this subject (term-match OR result-match),
  // excluding the subject searching themselves.
  const rows = await sql`
    WITH matches AS (
      SELECT sa.*,
             COALESCE(sa.searcher_user_id, sa.session_id, sa.searcher_name_norm, sa.id::text) AS searcher_key
      FROM search_activity sa
      WHERE (
              (sa.term_name_norm = ${subjNorm}
                 AND (${state}::text IS NULL OR sa.term_state = ${state} OR sa.term_state IS NULL))
              OR EXISTS (
                SELECT 1 FROM search_results sr
                WHERE sr.activity_id = sa.id AND sr.name_norm = ${subjNorm}
                  AND (${state}::text IS NULL OR sr.state = ${state} OR sr.state IS NULL)
              )
            )
        AND (${selfUserId}::text IS NULL OR sa.searcher_user_id IS DISTINCT FROM ${selfUserId})
        AND (sa.searcher_name_norm IS DISTINCT FROM ${subjNorm})
    )
    SELECT searcher_key,
           max(searcher_name)  AS searcher_name,
           max(searcher_first) AS searcher_first,
           max(searcher_city)  AS searcher_city,
           max(searcher_state) AS searcher_state,
           bool_or(searcher_type = 'member') AS is_member,
           count(*)::int       AS times,
           max(received_at)    AS last_at,
           (array_agg(search_type ORDER BY received_at DESC))[1] AS last_type
    FROM matches
    GROUP BY searcher_key
    ORDER BY last_at DESC
    LIMIT ${limit}
  `;

  const visible = rows.filter((r) => !isSuppressed(r));
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
