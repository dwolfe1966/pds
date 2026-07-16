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
function titleCase(s) { return s ? String(s).trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''; }

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
      SELECT user_id, occupation, employer, relatives, high_school_norm, college_norm, past_locations,
             (self_person <> '{}'::jsonb) AS mapped
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
      const rows = await sql`SELECT self_person, attributes, city, state FROM member_enrichment WHERE user_id = ${selfUserId}`;
      const row = rows[0];
      // (1) MAPPED IDENTITY — the confirmed self-identify record. Highest precision (real record,
      // incl. middle names) → exact result-matches + overlap affinities.
      const sp = row && row.self_person;
      if (sp && typeof sp === 'object' && sp.name) {
        return { name: sp.name, city: sp.city || identity.city || '', state: sp.state || identity.state || '', selfUserId, source: 'mapped_identity' };
      }
      // (2) CARD INFO — the cardholder name captured at checkout (stored in attributes). Their real
      // name for the vast majority of members, available even when they never map.
      const attr = (row && row.attributes && typeof row.attributes === 'object') ? row.attributes : {};
      if (attr.cardName) {
        return { name: attr.cardName, city: attr.cardCity || row.city || identity.city || '', state: attr.cardState || row.state || identity.state || '', selfUserId, source: 'card_info' };
      }
      // (3) SELF-PROVIDED — a name the member gave about themselves in any form (stored).
      if (attr.providedName) {
        return { name: attr.providedName, city: attr.providedCity || row.city || identity.city || '', state: attr.providedState || row.state || identity.state || '', selfUserId, source: 'self_provided' };
      }
    } catch { /* table absent or row missing — fall through to the live self-provided value */ }
  }
  // (3, live) SELF-PROVIDED, client-passed. Never the account fullName (that's the search TARGET) —
  // callers must pass the member's OWN name here.
  return { name: identity.name || '', city: identity.city || '', state: identity.state || '', selfUserId, source: 'self_provided' };
}

// The SUBJECT's own enrichment — needed for OVERLAP affinities (same high school/college/employer).
async function fetchSubjectEnrichment(userId) {
  if (!userId) return null;
  try {
    const rows = await sql`
      SELECT occupation, employer, high_school, high_school_norm, college, college_norm, relatives
      FROM member_enrichment WHERE user_id = ${userId}`;
    return rows[0] || null;
  } catch {
    return null;
  }
}

/**
 * "Who VIEWED my profile" reverse-join — a distinct, higher-intent stream from searches (they opened
 * the full profile). Matched on the viewed subject (exact norm, or same last + fuzzy first as the
 * recall net), self-views excluded, suppressed viewers dropped. Free = masked, paid = named.
 */
async function queryProfileViewers({ subjNorm, subjFirst, subjLast, state, selfUserId, paid, limit = 200 }) {
  if (!subjNorm) return { count: 0, viewers: [] };
  const lastKey = subjLast || null;
  let rows;
  try {
    rows = await sql`
      SELECT pv.id, pv.viewer_type, pv.viewer_user_id, pv.session_id, pv.viewer_name, pv.viewer_first,
             pv.viewer_city, pv.viewer_state, pv.subject_first, pv.source,
             COALESCE(pv.viewed_at, pv.received_at) AS at,
             COALESCE(pv.viewer_user_id, pv.session_id, pv.viewer_name_norm, pv.id::text) AS viewer_key,
             (pv.subject_name_norm = ${subjNorm}) AS exact
      FROM profile_views pv
      WHERE (pv.subject_name_norm = ${subjNorm}
              OR (${lastKey}::text IS NOT NULL AND pv.subject_last = ${lastKey}))
        AND (${state}::text IS NULL OR pv.subject_state = ${state} OR pv.subject_state IS NULL)
        AND (${selfUserId}::text IS NULL OR pv.viewer_user_id IS DISTINCT FROM ${selfUserId})
      ORDER BY at DESC
      LIMIT 2000`;
  } catch {
    return { count: 0, viewers: [] }; // table absent — degrade
  }
  const matched = rows.filter((r) => r.exact || fuzzyFirst(r.subject_first, subjFirst));
  const byKey = new Map();
  for (const r of matched) {
    let g = byKey.get(r.viewer_key);
    if (!g) {
      g = { viewer_key: r.viewer_key, viewer_user_id: r.viewer_user_id, name: r.viewer_name,
        first: r.viewer_first, city: r.viewer_city, state: r.viewer_state,
        is_member: r.viewer_type === 'member', times: 0, last_at: r.at };
      byKey.set(r.viewer_key, g);
    }
    g.times += 1;
    if (r.at > g.last_at) g.last_at = r.at;
    if (!g.name && r.viewer_name) g.name = r.viewer_name;
    if (r.viewer_type === 'member') g.is_member = true;
  }
  const allIds = [...byKey.values()].map((g) => g.viewer_user_id).filter(Boolean);
  const suppressed = await getSuppressedUserIds(allIds);
  // Mapped viewers (claimed their identity) are exposed by name even when reveal-gated.
  let mappedSet = new Set();
  if (allIds.length) {
    try {
      const mrows = await sql`SELECT user_id FROM member_enrichment WHERE user_id = ANY(${allIds}) AND self_person <> '{}'::jsonb`;
      mappedSet = new Set(mrows.map((r) => r.user_id));
    } catch { /* degrade — treat none as mapped */ }
  }
  const viewers = [...byKey.values()]
    .filter((g) => !(g.viewer_user_id && suppressed.has(g.viewer_user_id)))
    .sort((a, b) => (a.last_at < b.last_at ? 1 : a.last_at > b.last_at ? -1 : 0))
    .slice(0, limit)
    .map((g) => {
      const mapped = !!(g.viewer_user_id && mappedSet.has(g.viewer_user_id));
      return {
        key: String(g.viewer_key), times: g.times, timestamp: g.last_at, state: g.state || '',
        isMember: g.is_member, mapped,
        name: (paid || mapped) ? (g.name || (g.is_member ? 'Member' : 'Anonymous visitor')) : maskLabel(g.name),
      };
    });
  return { count: viewers.length, viewers };
}

/**
 * @param {object} identity  { name, city, state, selfUserId }
 * @param {object} opts       { tier: 'free'|'paid', limit }
 * @returns {Promise<object>} { count, keySignals[], profileViews:{count,viewers[]}, teaseSummary, events[] }
 */
export async function buildWsfySummary(identity, opts = {}) {
  if (!sql) throw new Error('no WSFY DB configured');
  const paid = opts.tier === 'paid';
  // Subject identity: confirmed self-identify record when mapped, else the account name.
  const subj = await resolveSubjectIdentity(identity);
  const subjNorm = norm(`${subj.name || ''}`);
  if (!subjNorm) return { count: 0, tier: paid ? 'paid' : 'free', matchedVia: subj.source, keySignalCount: 0, keySignals: [], sameStateCount: 0, highlights: [], teaseSummary: { headline: 'No search activity yet', lines: [] }, events: [] };

  // Split subject → exact last + fuzzy first. `lastKey` null (no last name) disables the
  // term-last branch so we fall back to result-matches only.
  const parts = subjNorm.split(' ');
  const subjFirst = parts[0] || '';
  const subjLast = parts.length > 1 ? parts[parts.length - 1] : '';
  const lastKey = subjLast || null;

  const state = subj.state ? String(subj.state).trim().toUpperCase() : null;
  const selfUserId = subj.selfUserId || null;

  // REVEAL GATE (owner 2026-07-16): real searcher/viewer names + exact PII are unmasked only when the
  // member has CLAIMED this identity (mapped_identity → required KBA at mapping). Paid-but-unmapped
  // (card/self-provided) still gets the full masked tease — just not the reveal. This closes the
  // "type any name → see who's searching" hole. CEILING: tier + selfUserId are still client-asserted
  // (app-key only) — full closure needs WSFY auth-hardening (derive both from a trusted BC token).
  // To also accept card-tier as sufficient, add `|| subj.source === 'card_info'` here.
  const REVEAL_REQUIRES = 'mapped_identity';
  const reveal = paid && subj.source === REVEAL_REQUIRES;

  // MAXIMIZE RECALL (owner 2026-07-16): catch every plausible searcher via three signals, and tag
  // each row's PRECISION so high-confidence matches can be elevated separately from the broad count.
  //   result_exact  = subject's exact name appeared in a result set (+ state)         → high
  //   result_fuzzy  = a "First … Last" middle-name variant appeared (e.g. David L Wolfe) → medium
  //   term-last + fuzzy first typed                                                    → low (recall net)
  // `startsPat`/`endsPat` widen result-matching to middle-name variants (norm has no LIKE metachars).
  const startsPat = subjFirst ? `${subjFirst} %` : null;
  const endsPat = subjLast ? `% ${subjLast}` : null;
  const rows = await sql`
    SELECT sa.id, sa.searcher_type, sa.searcher_user_id, sa.session_id, sa.searcher_name_norm,
           sa.searcher_name, sa.searcher_first, sa.searcher_city, sa.searcher_state,
           sa.term_first, sa.term_last, sa.term_state, sa.search_type, sa.received_at,
           COALESCE(sa.searcher_user_id, sa.session_id, sa.searcher_name_norm, sa.id::text) AS searcher_key,
           EXISTS (SELECT 1 FROM search_results sr WHERE sr.activity_id = sa.id AND sr.name_norm = ${subjNorm}
                   AND (${state}::text IS NULL OR sr.state = ${state} OR sr.state IS NULL)) AS result_exact,
           (${startsPat}::text IS NOT NULL AND ${endsPat}::text IS NOT NULL AND EXISTS (
                   SELECT 1 FROM search_results sr WHERE sr.activity_id = sa.id
                   AND sr.name_norm LIKE ${startsPat} AND sr.name_norm LIKE ${endsPat}
                   AND (${state}::text IS NULL OR sr.state = ${state} OR sr.state IS NULL))) AS result_fuzzy
    FROM search_activity sa
    WHERE (
            (${lastKey}::text IS NOT NULL AND sa.term_last = ${lastKey}
               AND (${state}::text IS NULL OR sa.term_state = ${state} OR sa.term_state IS NULL))
            OR EXISTS (SELECT 1 FROM search_results sr WHERE sr.activity_id = sa.id AND sr.name_norm = ${subjNorm}
                       AND (${state}::text IS NULL OR sr.state = ${state} OR sr.state IS NULL))
            OR (${startsPat}::text IS NOT NULL AND ${endsPat}::text IS NOT NULL AND EXISTS (
                   SELECT 1 FROM search_results sr WHERE sr.activity_id = sa.id
                   AND sr.name_norm LIKE ${startsPat} AND sr.name_norm LIKE ${endsPat}
                   AND (${state}::text IS NULL OR sr.state = ${state} OR sr.state IS NULL)))
          )
      AND (${selfUserId}::text IS NULL OR sa.searcher_user_id IS DISTINCT FROM ${selfUserId})
      AND (sa.searcher_name_norm IS DISTINCT FROM ${subjNorm})
    ORDER BY sa.received_at DESC
    LIMIT 4000
  `;

  // Keep result-matches (exact or middle-name variant) + same-last rows whose first name fuzzy-matches.
  const matched = rows.filter((r) => r.result_exact || r.result_fuzzy || fuzzyFirst(r.term_first, subjFirst));
  // Per-row precision: exact record OR exact first+last typed = high; middle-name variant = medium;
  // same-last + fuzzy-first (nickname/typo) = low (the recall net).
  const CONF_RANK = { low: 0, medium: 1, high: 2 };
  const rowConfidence = (r) => {
    if (r.result_exact) return 'high';
    if (lastKey && r.term_last === lastKey && subjFirst && norm(r.term_first) === subjFirst) return 'high';
    if (r.result_fuzzy) return 'medium';
    return 'low';
  };

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
        confidence: 'low',
      };
      byKey.set(r.searcher_key, g);
    }
    const rc = rowConfidence(r);
    if (CONF_RANK[rc] > CONF_RANK[g.confidence]) g.confidence = rc;
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
  // Subject's own institution display names (their data → safe to name in reasons/highlights).
  const collegeName = (subjE && (subjE.college || titleCase(subjE.college_norm))) || '';
  const hsName = (subjE && (subjE.high_school || titleCase(subjE.high_school_norm))) || '';
  const employerName = (subjE && subjE.employer) || '';
  const aff = new Map();
  for (const g of visible) {
    const tags = [];
    const e = g.searcher_user_id ? enrich.get(g.searcher_user_id) : null;
    // A searcher who has CLAIMED their own identity is an identifiable community member — expose their
    // name even to a reveal-gated subject (owner 2026-07-16). Suppression still drops "hidden" members.
    g.mapped = !!(e && e.mapped);
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

  // ── KEY SIGNALS (owner 2026-07-16): the high-precision OR high-value subset, elevated apart from
  // the broad recall count. A searcher qualifies if we're confident it's really them (confidence
  // 'high') OR they're meaningful (an affinity, a repeat, a member, or a contact-info search). Each
  // carries a human reason. `count` stays the wide net; `keySignals` is the signal within the noise.
  const REASON_FOR = (g, tags) => {
    if (tags.includes('verified_relative') || tags.includes('relative')) return 'May be family';
    if (tags.includes('colleague')) return employerName ? `Worked at ${employerName}` : 'May be a colleague';
    if (tags.includes('college')) return collegeName ? `Went to ${collegeName}` : 'Went to your college';
    if (tags.includes('high_school')) return hsName ? `Went to ${hsName}` : 'Went to your high school';
    if (tags.includes('shared_relative')) return 'Shares a relative with you';
    if (tags.includes('local')) return 'In your area';
    if (tags.includes('past_local')) return 'Once lived in your area';
    if (g.last_type === 'phone') return 'Searched you by phone';
    if (g.last_type === 'email') return 'Searched you by email';
    if (g.times >= 2) return `Searched you ${g.times}×`;
    if (g.confidence === 'high') return 'Searched your exact name';
    if (g.is_member) return 'A member searched you';
    return 'Searched for you';
  };
  const keySignals = [];
  for (const g of visible) {
    const tags = (aff.get(g.searcher_key) || { tags: [] }).tags;
    const contactSearch = g.last_type === 'phone' || g.last_type === 'email';
    const valueHigh = tags.length > 0 || g.times >= 2 || g.is_member || contactSearch;
    if (g.confidence !== 'high' && !valueHigh) continue; // not a key signal — stays in the broad count only
    keySignals.push({
      key: String(g.searcher_key), confidence: g.confidence, reason: REASON_FOR(g, tags),
      affinities: tags, times: g.times, searchType: TYPE_LABEL[g.last_type] || cap(g.last_type) || 'Name',
      timestamp: g.last_at, state: g.searcher_state || '', mapped: !!g.mapped,
      name: (reveal || g.mapped) ? (g.searcher_name || (g.is_member ? 'Member' : 'Anonymous visitor')) : maskLabel(g.searcher_name),
    });
  }
  keySignals.sort((a, b) => (CONF_RANK[b.confidence] - CONF_RANK[a.confidence]) || (a.timestamp < b.timestamp ? 1 : -1));

  // ── Events list (for the page's table + charts) — tiered ─────────────────
  const events = visible.map((r, i) => {
    const isMember = !!r.is_member;
    const tier = isMember ? 'Basic' : 'Visitor';
    const searchType = TYPE_LABEL[r.last_type] || cap(r.last_type) || 'Name';
    const a = aff.get(r.searcher_key) || { tags: [] };
    const base = { id: String(r.searcher_key || i), timestamp: r.last_at, searchType, tier, times: r.times, affinities: a.tags, confidence: r.confidence, mapped: !!r.mapped };
    if (reveal || r.mapped) {
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

  // 1b. Shared history (user-provided overlaps): high school, college, employer — NAMED via the
  // subject's own institution (collegeName/hsName/employerName computed above), else generic.
  const byTag = (tag) => visible.filter((g) => !used.has(g.searcher_key) && aff.get(g.searcher_key).tags.includes(tag));
  const hs = byTag('high_school');
  if (hs.length) { lines.push(`${hs.length} who went to ${hsName || 'your high school'}`); take(hs); }
  const col = byTag('college');
  if (col.length) { lines.push(`${col.length} who went to ${collegeName || 'your college'}`); take(col); }
  const colleague = byTag('colleague');
  if (colleague.length) { lines.push(employerName ? `${colleague.length} who worked at ${employerName}` : `${colleague.length} who may be ${colleague.length === 1 ? 'a colleague' : 'colleagues'}`); take(colleague); }

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

  // ── Highlights: the specific, named callouts for the payment teaser (owner 2026-07-16). Computed
  // over ALL matched searchers (not de-duped via `used`), each a standalone "why they matter" chip.
  const tagCount = (tag) => visible.filter((g) => aff.get(g.searcher_key).tags.includes(tag)).length;
  const sameStateCount = state ? visible.filter((g) => (g.searcher_state || '').toUpperCase() === state).length : 0;
  const highlights = [];
  const relTotal = tagCount('relative');
  if (relTotal) highlights.push({ key: 'relative', icon: '👪', text: `${relTotal} may be ${relTotal === 1 ? 'a relative' : 'relatives'}` });
  const colTotal = tagCount('college');
  if (colTotal && collegeName) highlights.push({ key: 'college', icon: '🎓', text: `${colTotal} went to ${collegeName}` });
  const hsTotal = tagCount('high_school');
  if (hsTotal && hsName) highlights.push({ key: 'high_school', icon: '🏫', text: `${hsTotal} went to ${hsName}` });
  const empTotal = tagCount('colleague');
  if (empTotal && employerName) highlights.push({ key: 'colleague', icon: '💼', text: `${empTotal} worked at ${employerName}` });
  if (sameStateCount) highlights.push({ key: 'same_state', icon: '📍', text: `${sameStateCount} searching from your state` });
  const localTotal = tagCount('local');
  if (localTotal) highlights.push({ key: 'local', icon: '🏠', text: `${localTotal} in your area` });

  // "Who viewed my profile" — a distinct higher-intent stream, matched on the same resolved subject.
  const profileViews = await queryProfileViewers({ subjNorm, subjFirst, subjLast, state, selfUserId, paid: reveal });

  return {
    count, tier: paid ? 'paid' : 'free', matchedVia: subj.source, sameStateCount,
    // reveal = real names shown; revealGated = paid but not mapped → drive "claim your record to unlock".
    reveal, revealGated: paid && !reveal,
    keySignalCount: keySignals.length, keySignals, highlights, profileViews,
    teaseSummary: { headline, lines }, events,
  };
}
