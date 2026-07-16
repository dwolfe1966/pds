// WSFY ("Who's Searching For You") reverse-join + tiered summary. Given a subscriber's
// identity, find who searched for them and build a FREE (obfuscated tease) or PAID (full
// detail) view. Masking happens HERE, server-side — a free client never receives real names.
//
// Match on stable attributes (normalized name + state), never extId (ephemeral). Data source
// is the Phase-1 corpus (search_activity + search_results). Affinity descriptors that need
// data we don't license yet (e.g. "went to your high school", "just got married") are NOT
// fabricated — we ship the sourceable subset (count, location, one proof name) honestly.
import { neon } from '@neondatabase/serverless';
import { norm, getSuppressedUserIds, getHiddenFieldsMap } from './search-activity-db.mjs';

// Per-item suppression: when a member hides an exposure driver, its WSFY affinity is never surfaced
// about them. Maps an exposure-driver key → the affinity tags it governs.
const TAG_SUPPRESS = {
  employment: ['occupation', 'colleague'],
  education: ['high_school', 'college'],
  past: ['past_local'],
  relatives: ['relative', 'verified_relative', 'shared_relative'],
  location: ['local'],
};

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

const lastToken = (name) => {
  const p = norm(name || '').split(' ').filter(Boolean);
  return p.length > 1 ? p[p.length - 1] : '';
};

// Phase 2b enrichment SEAM. Occupation / employer / verified relatives per member searcher live
// in `member_enrichment` (populated by a separate pipeline — a browser-side BC self-lookup on the
// member, since BC is IIFE-only + COGS; see docs). This join is OPTIONAL: if the table is empty or
// absent the tease degrades to corpus-derived affinities (relative-by-surname, same-city, repeat).
async function fetchEnrichment(userIds) {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return new Map();
  try {
    const rows = await sql`
      SELECT user_id, occupation, employer, relatives, high_school_norm, college_norm, past_locations
      FROM member_enrichment WHERE user_id = ANY(${ids})`;
    return new Map(rows.map((r) => [r.user_id, r]));
  } catch {
    return new Map(); // table not created yet — degrade gracefully
  }
}

// Resolve the effective subject identity for the reverse-join. Owner (2026-07-16): match WSFY to
// the member's CONFIRMED self-identify record when they have one, else fall back to the loose
// account name. self_person = { name, age, city, state } — the exact record they matched (incl.
// middle names), so `sr.name_norm = subjNorm` result-matches hit the real person, not a generic
// "First Last" that no result row equals. Unmapped members still match on their account name.
async function resolveSubjectIdentity(identity) {
  const selfUserId = identity.selfUserId || null;
  if (selfUserId) {
    try {
      const rows = await sql`SELECT self_person FROM member_enrichment WHERE user_id = ${selfUserId}`;
      const sp = rows[0] && rows[0].self_person;
      if (sp && typeof sp === 'object' && sp.name) {
        return {
          name: sp.name,
          city: sp.city || identity.city || '',
          state: sp.state || identity.state || '',
          selfUserId,
          source: 'self_identify',
        };
      }
    } catch { /* table absent or row missing — fall through to the account name */ }
  }
  return {
    name: identity.name || '',
    city: identity.city || '',
    state: identity.state || '',
    selfUserId,
    source: 'account_name',
  };
}

// The SUBJECT's own enrichment — needed for OVERLAP affinities (same high school/college/employer).
async function fetchSubjectEnrichment(userId) {
  if (!userId) return null;
  try {
    const rows = await sql`
      SELECT occupation, employer, high_school_norm, college_norm, relatives
      FROM member_enrichment WHERE user_id = ${userId}`;
    return rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * @param {object} identity  { name, city, state, selfUserId }
 * @param {object} opts       { tier: 'free'|'paid', limit }
 * @returns {Promise<object>} { count, tier, teaseSummary:{headline,lines[]}, events[] }
 */
export async function buildWsfySummary(identity, opts = {}) {
  if (!sql) throw new Error('no WSFY DB configured');
  const paid = opts.tier === 'paid';
  // Subject identity: confirmed self-identify record when mapped, else the account name.
  const subj = await resolveSubjectIdentity(identity);
  const subjNorm = norm(`${subj.name || ''}`);
  if (!subjNorm) return { count: 0, tier: paid ? 'paid' : 'free', matchedVia: subj.source, teaseSummary: { headline: 'No search activity yet', lines: [] }, events: [] };

  // Split subject → exact last + fuzzy first. `lastKey` null (no last name) disables the
  // term-last branch so we fall back to result-matches only.
  const parts = subjNorm.split(' ');
  const subjFirst = parts[0] || '';
  const subjLast = parts.length > 1 ? parts[parts.length - 1] : '';
  const lastKey = subjLast || null;

  const state = subj.state ? String(subj.state).trim().toUpperCase() : null;
  const selfUserId = subj.selfUserId || null;

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

  // Member suppression ("Hide me"): searchers who opted out don't appear in anyone's WSFY.
  const suppressed = await getSuppressedUserIds(matched.map((r) => r.searcher_user_id));

  // Aggregate per distinct searcher.
  const byKey = new Map();
  for (const r of matched) {
    if (r.searcher_user_id && suppressed.has(r.searcher_user_id)) continue;
    if (isSuppressed(r)) continue;
    let g = byKey.get(r.searcher_key);
    if (!g) {
      g = {
        searcher_key: r.searcher_key, searcher_user_id: r.searcher_user_id,
        searcher_name: r.searcher_name, searcher_first: r.searcher_first,
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

  // ── Affinity computation (Phase 2b) ──────────────────────────────────────
  // Per searcher, derive why they might matter to the subject. Corpus-derived signals need no
  // enrichment; occupation/verified-relative come from the enrichment seam when present.
  const subjCityN = norm(subj.city || '');
  const memberIds = visible.filter((g) => g.is_member).map((g) => g.searcher_user_id);
  const [enrich, subjE, hiddenMap] = await Promise.all([
    fetchEnrichment(memberIds),
    fetchSubjectEnrichment(selfUserId),
    getHiddenFieldsMap(memberIds),
  ]);
  const aff = new Map();
  for (const g of visible) {
    const tags = [];
    const e = g.searcher_user_id ? enrich.get(g.searcher_user_id) : null;
    const sLast = lastToken(g.searcher_name);
    const relByName = !!(sLast && subjLast && sLast === subjLast); // shares your surname → likely family
    const relVerified = !!(e?.relatives && Array.isArray(e.relatives) && e.relatives.some((n) => norm(n) === subjNorm));
    if (relByName || relVerified) tags.push('relative');
    if (relVerified) tags.push('verified_relative');
    if (g.searcher_city && subjCityN && norm(g.searcher_city) === subjCityN) tags.push('local');
    // Once lived in your area — a PAST address of the searcher matches the subject's current city.
    if (subjCityN && e?.past_locations && Array.isArray(e.past_locations)
        && e.past_locations.some((loc) => norm(loc).includes(subjCityN))) tags.push('past_local');
    if (g.times >= 2) tags.push('frequent');
    if (e?.occupation) tags.push('occupation');
    // Contact-info signals — they searched you BY phone/email, so they already have it.
    if (g.last_type === 'phone') tags.push('has_phone');
    if (g.last_type === 'email') tags.push('has_email');
    // Overlap affinities — need BOTH the searcher's and the subject's enrichment.
    if (e && subjE) {
      if (e.high_school_norm && subjE.high_school_norm && e.high_school_norm === subjE.high_school_norm) tags.push('high_school');
      if (e.college_norm && subjE.college_norm && e.college_norm === subjE.college_norm) tags.push('college');
      if (e.employer && subjE.employer && norm(e.employer) === norm(subjE.employer)) tags.push('colleague');
      // Shares a relative with you — the searcher's and your relatives lists overlap.
      if (Array.isArray(e.relatives) && Array.isArray(subjE.relatives) && subjE.relatives.length) {
        const subjRel = new Set(subjE.relatives.map((n) => norm(n)));
        if (e.relatives.some((n) => subjRel.has(norm(n)))) tags.push('shared_relative');
      }
    }
    // Per-item suppression: drop any affinity tag whose exposure driver this searcher has hidden,
    // and blank the occupation/employer detail when employment is hidden.
    const hidden = g.searcher_user_id ? hiddenMap.get(g.searcher_user_id) : null;
    let finalTags = tags;
    let occ = e?.occupation || null;
    let emp = e?.employer || null;
    if (hidden && hidden.length) {
      const blocked = new Set(hidden.flatMap((k) => TAG_SUPPRESS[k] || []));
      finalTags = tags.filter((t) => !blocked.has(t));
      if (hidden.includes('employment')) { occ = null; emp = null; }
    }
    aff.set(g.searcher_key, { tags: finalTags, occupation: occ, employer: emp });
  }

  // ── Events list (for the page's table + charts) — tiered ─────────────────
  const events = visible.map((r, i) => {
    const isMember = !!r.is_member;
    const tier = isMember ? 'Basic' : 'Visitor';
    const searchType = TYPE_LABEL[r.last_type] || cap(r.last_type) || 'Name';
    const a = aff.get(r.searcher_key) || { tags: [] };
    const base = { id: String(r.searcher_key || i), timestamp: r.last_at, searchType, tier, times: r.times, affinities: a.tags };
    if (paid) {
      return {
        ...base,
        name: r.searcher_name || (isMember ? 'Member' : 'Anonymous visitor'),
        firstName: r.searcher_first || (r.searcher_name ? r.searcher_name[0] : ''),
        city: r.searcher_city || '',
        state: r.searcher_state || '',
        occupation: a.occupation || '',
      };
    }
    // FREE: no real name/city leaves the server; coarse state + non-PII affinity tags only.
    return { ...base, name: maskLabel(r.searcher_name), firstName: '', city: '', state: r.searcher_state || '' };
  });

  // ── Tease summary (the conversion hook — "4 people are searching for you: …") ──
  const headline = count === 0
    ? 'No one has searched for you yet'
    : `${count} ${plural(count, 'person', 'people')} ${plural(count, 'is', 'are')} searching for you`;
  const lines = [];
  const used = new Set();
  const take = (gs) => gs.forEach((g) => used.add(g.searcher_key));

  // 1. Possible relatives — highest intrigue, lead with it.
  const rel = visible.filter((g) => aff.get(g.searcher_key).tags.includes('relative'));
  if (rel.length) { lines.push(`${rel.length} who may be ${rel.length === 1 ? 'a relative' : 'relatives'}`); take(rel); }

  // 1b. Shared history (user-provided overlaps): high school, college, employer.
  const byTag = (tag) => visible.filter((g) => !used.has(g.searcher_key) && aff.get(g.searcher_key).tags.includes(tag));
  const hs = byTag('high_school');
  if (hs.length) { lines.push(`${hs.length} who went to your high school`); take(hs); }
  const col = byTag('college');
  if (col.length) { lines.push(`${col.length} who went to your college`); take(col); }
  const colleague = byTag('colleague');
  if (colleague.length) { lines.push(`${colleague.length} who may be ${colleague.length === 1 ? 'a colleague' : 'colleagues'}`); take(colleague); }

  // 2. In your area (subject's own city).
  const loc = visible.filter((g) => !used.has(g.searcher_key) && aff.get(g.searcher_key).tags.includes('local'));
  if (loc.length) { lines.push(`${loc.length} in your area`); take(loc); }

  // 3. Other top cities among the not-yet-highlighted.
  const cityCounts = {};
  for (const g of visible) { if (!used.has(g.searcher_key) && g.searcher_city) cityCounts[g.searcher_city] = (cityCounts[g.searcher_city] || 0) + 1; }
  for (const [city, c] of Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).slice(0, 2)) {
    lines.push(`${c} near ${city}`);
    take(visible.filter((g) => !used.has(g.searcher_key) && g.searcher_city === city).slice(0, c));
  }

  // 4. One "proof" name — reveal a real searcher (with occupation if enriched) to prove it's real.
  const proof = visible.find((g) => aff.get(g.searcher_key).occupation && g.searcher_name)
    || visible.find((g) => g.is_member && g.searcher_name);
  if (proof) {
    const pe = aff.get(proof.searcher_key);
    lines.push(pe.occupation ? `${proof.searcher_name} (works in ${pe.occupation})` : proof.searcher_name);
    used.add(proof.searcher_key);
  }

  // 5. Remainder (accurate — de-duped via the used set).
  const remainder = count - used.size;
  if (remainder > 0) lines.push(`and ${remainder} more`);

  return { count, tier: paid ? 'paid' : 'free', matchedVia: subj.source, teaseSummary: { headline, lines }, events };
}
