// Neon client for the search-activity store (WSFY data layer). Same DB as leads/abandoned
// (LEADS_DATABASE_URL || DATABASE_URL). Schema: seo/db/search-activity-schema.sql.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasSearchDb = !!URL;
const sql = hasSearchDb ? neon(URL) : null;

/** Upsert one member's enrichment (WSFY Phase 2b). Merges partial updates from either source
 *  (self-report extraction OR user-provided profile). Schema: seo/db/member-enrichment-schema.sql. */
export async function upsertMemberEnrichment(e) {
  if (!sql) throw new Error('no DB configured');
  if (!e || !e.userId) throw new Error('userId required');
  const relatives = Array.isArray(e.relatives) ? e.relatives : [];
  const attributes = e.attributes && typeof e.attributes === 'object' ? e.attributes : {};
  const selfPerson = e.selfPerson && typeof e.selfPerson === 'object' ? e.selfPerson : {};
  const pastLocations = Array.isArray(e.pastLocations) ? e.pastLocations : [];
  const hs = e.highSchool ? String(e.highSchool).trim() : null;
  const col = e.college ? String(e.college).trim() : null;
  await sql`
    INSERT INTO member_enrichment
      (user_id, occupation, employer, relatives, city, state, high_school, high_school_norm,
       college, college_norm, attributes, report_id, self_person, past_locations, verified_level, source, enriched_at)
    VALUES (
      ${e.userId}, ${e.occupation || null}, ${e.employer || null}, ${JSON.stringify(relatives)}::jsonb,
      ${e.city || null}, ${e.state || null}, ${hs}, ${hs ? norm(hs) : null},
      ${col}, ${col ? norm(col) : null}, ${JSON.stringify(attributes)}::jsonb,
      ${e.reportId || null}, ${JSON.stringify(selfPerson)}::jsonb, ${JSON.stringify(pastLocations)}::jsonb, ${e.verified || null}, ${e.source || null}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      occupation = COALESCE(EXCLUDED.occupation, member_enrichment.occupation),
      employer   = COALESCE(EXCLUDED.employer, member_enrichment.employer),
      relatives  = CASE WHEN jsonb_array_length(EXCLUDED.relatives) > 0 THEN EXCLUDED.relatives ELSE member_enrichment.relatives END,
      city = COALESCE(EXCLUDED.city, member_enrichment.city),
      state = COALESCE(EXCLUDED.state, member_enrichment.state),
      high_school = COALESCE(EXCLUDED.high_school, member_enrichment.high_school),
      high_school_norm = COALESCE(EXCLUDED.high_school_norm, member_enrichment.high_school_norm),
      college = COALESCE(EXCLUDED.college, member_enrichment.college),
      college_norm = COALESCE(EXCLUDED.college_norm, member_enrichment.college_norm),
      attributes = member_enrichment.attributes || EXCLUDED.attributes,
      report_id = COALESCE(EXCLUDED.report_id, member_enrichment.report_id),
      self_person = CASE WHEN EXCLUDED.self_person <> '{}'::jsonb THEN EXCLUDED.self_person ELSE member_enrichment.self_person END,
      past_locations = CASE WHEN jsonb_array_length(EXCLUDED.past_locations) > 0 THEN EXCLUDED.past_locations ELSE member_enrichment.past_locations END,
      verified_level = COALESCE(EXCLUDED.verified_level, member_enrichment.verified_level),
      source = EXCLUDED.source, enriched_at = now()
  `;
}

// ── Member suppression (Identity Management "Hide me") ───────────────────────
// Global "Hide my activity" flag. Keeps the row when turning off if the member still has per-field
// hides; only removes it when nothing is suppressed anymore.
export async function setSuppression({ userId, name, state, on }) {
  if (!sql) throw new Error('no DB configured');
  if (!userId) throw new Error('userId required');
  await sql`
    INSERT INTO member_suppression (user_id, name_norm, state, activity_hidden)
    VALUES (${userId}, ${name ? norm(name) : null}, ${state ? String(state).toUpperCase() : null}, ${!!on})
    ON CONFLICT (user_id) DO UPDATE SET
      activity_hidden = ${!!on},
      name_norm = COALESCE(EXCLUDED.name_norm, member_suppression.name_norm),
      state = COALESCE(EXCLUDED.state, member_suppression.state)`;
  if (!on) {
    await sql`DELETE FROM member_suppression WHERE user_id = ${userId}
      AND activity_hidden = false AND (hidden_fields IS NULL OR cardinality(hidden_fields) = 0)`;
  }
}

// Per-item ("hide this") suppression of a single exposure driver (location/past/relatives/
// employment/education/report). A field-only hide creates the row with activity_hidden = false.
export async function setFieldSuppression({ userId, name, state, key, on }) {
  if (!sql) throw new Error('no DB configured');
  if (!userId || !key) throw new Error('userId and key required');
  await sql`
    INSERT INTO member_suppression (user_id, name_norm, state, activity_hidden, hidden_fields)
    VALUES (${userId}, ${name ? norm(name) : null}, ${state ? String(state).toUpperCase() : null}, false, '{}')
    ON CONFLICT (user_id) DO UPDATE SET
      name_norm = COALESCE(EXCLUDED.name_norm, member_suppression.name_norm),
      state = COALESCE(EXCLUDED.state, member_suppression.state)`;
  if (on) {
    await sql`UPDATE member_suppression
      SET hidden_fields = (SELECT ARRAY(SELECT DISTINCT unnest(array_append(COALESCE(hidden_fields, '{}'), ${key}))))
      WHERE user_id = ${userId}`;
  } else {
    await sql`UPDATE member_suppression
      SET hidden_fields = array_remove(COALESCE(hidden_fields, '{}'), ${key})
      WHERE user_id = ${userId}`;
    await sql`DELETE FROM member_suppression WHERE user_id = ${userId}
      AND activity_hidden = false AND (hidden_fields IS NULL OR cardinality(hidden_fields) = 0)`;
  }
}

// Full suppression state for a member — { activityHidden, hiddenFields } — drives the Identity view.
export async function getSuppressionState(userId) {
  const empty = { activityHidden: false, hiddenFields: [], dispositions: {} };
  if (!sql || !userId) return empty;
  try {
    const rows = await sql`SELECT activity_hidden, hidden_fields, dispositions FROM member_suppression WHERE user_id = ${userId}`;
    if (!rows.length) return empty;
    return { activityHidden: !!rows[0].activity_hidden, hiddenFields: rows[0].hidden_fields || [], dispositions: rows[0].dispositions || {} };
  } catch { return empty; }
}

// Per-module Protect/Promote disposition for the modular My Profile. 'protect'|'promote' sets the key;
// anything else (neutral) clears it. Stored in member_suppression.dispositions (JSONB map).
export async function setModuleDisposition({ userId, name, state, module, disposition }) {
  if (!sql) throw new Error('no DB configured');
  if (!userId || !module) throw new Error('userId and module required');
  await sql`
    INSERT INTO member_suppression (user_id, name_norm, state, activity_hidden, dispositions)
    VALUES (${userId}, ${name ? norm(name) : null}, ${state ? String(state).toUpperCase() : null}, false, '{}'::jsonb)
    ON CONFLICT (user_id) DO UPDATE SET
      name_norm = COALESCE(EXCLUDED.name_norm, member_suppression.name_norm),
      state = COALESCE(EXCLUDED.state, member_suppression.state)`;
  if (disposition === 'protect' || disposition === 'promote') {
    await sql`UPDATE member_suppression
      SET dispositions = COALESCE(dispositions, '{}'::jsonb) || jsonb_build_object(${module}::text, ${disposition}::text)
      WHERE user_id = ${userId}`;
  } else {
    await sql`UPDATE member_suppression
      SET dispositions = COALESCE(dispositions, '{}'::jsonb) - ${module}::text
      WHERE user_id = ${userId}`;
  }
}

// WSFY: searchers whose GLOBAL activity is hidden don't appear in anyone's WSFY at all.
export async function getSuppressedUserIds(userIds) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!sql || !ids.length) return new Set();
  try {
    const rows = await sql`SELECT user_id FROM member_suppression WHERE user_id = ANY(${ids}) AND activity_hidden = true`;
    return new Set(rows.map((r) => r.user_id));
  } catch { return new Set(); }
}

// WSFY: per-searcher hidden exposure keys, so a hidden driver's affinity is never surfaced about them.
export async function getHiddenFieldsMap(userIds) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!sql || !ids.length) return new Map();
  try {
    const rows = await sql`SELECT user_id, hidden_fields FROM member_suppression WHERE user_id = ANY(${ids})`;
    return new Map(rows.filter((r) => Array.isArray(r.hidden_fields) && r.hidden_fields.length).map((r) => [r.user_id, r.hidden_fields]));
  } catch { return new Map(); }
}

export async function isMemberSuppressed(userId) {
  if (!sql || !userId) return false;
  try { return (await sql`SELECT 1 FROM member_suppression WHERE user_id = ${userId} AND activity_hidden = true`).length > 0; }
  catch { return false; }
}

/** Read one member's enrichment (for the cross-device "My Identity" view). */
// A member's OWN search history (cross-device), read back from the corpus we already capture. Shape
// mirrors the client localStorage ring buffer so SearchHistoryPage can consume either interchangeably.
export async function getUserSearchHistory(userId, limit = 50) {
  if (!sql || !userId) return [];
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  try {
    const rows = await sql`
      SELECT id, search_type, source, terms, result_count, searched_at, received_at
      FROM search_activity
      WHERE searcher_user_id = ${userId} AND searcher_type = 'member'
      ORDER BY received_at DESC
      LIMIT ${lim}`;
    return rows.map((r) => ({
      id: String(r.id),
      timestamp: new Date(r.searched_at || r.received_at || Date.now()).getTime(),
      type: r.search_type || 'name',
      query: (r.terms && typeof r.terms === 'object') ? r.terms : {},
      resultCount: r.result_count != null ? r.result_count : 0,
      source: r.source || null,
    }));
  } catch { return []; }
}

// Delete one of a member's own captured searches (search_results cascades via FK). Scoped to the
// owner so a user can only remove their own rows.
export async function deleteUserSearchActivity(userId, id) {
  if (!sql || !userId || !id) return;
  try { await sql`DELETE FROM search_activity WHERE id = ${id} AND searcher_user_id = ${userId}`; } catch { /* noop */ }
}
export async function clearUserSearchActivity(userId) {
  if (!sql || !userId) return;
  try { await sql`DELETE FROM search_activity WHERE searcher_user_id = ${userId}`; } catch { /* noop */ }
}

export async function getMemberEnrichment(userId) {
  if (!sql) throw new Error('no DB configured');
  if (!userId) return null;
  const rows = await sql`
    SELECT user_id, occupation, employer, relatives, city, state, high_school, college,
           report_id, self_person, verified_level, enriched_at
    FROM member_enrichment WHERE user_id = ${userId}`;
  return rows[0] || null;
}

/** Normalize a name/place for matching: lowercase, strip punctuation, collapse spaces. */
export function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Capture teaser data one row PER PERSON, keyed by a stable profile_id (norm(name)|STATE|norm(city)) —
 * extId is ephemeral. Upserted from every search's result set so we accumulate a person corpus we own
 * (the source for public, crawlable Others-Profile pages). Deduped per batch; single round trip.
 */
export async function upsertPersonProfiles(results) {
  if (!sql || !Array.isArray(results) || !results.length) return;
  const byId = new Map();
  for (const r of results.slice(0, 40)) {
    const name = (r && (r.name || r.fullName)) || '';
    const nn = norm(name);
    if (!nn) continue;
    const city = (r.city || '') && String(r.city);
    const state = r.state ? String(r.state).trim().toUpperCase() : '';
    const parts = String(name).trim().split(/\s+/);
    const profileId = [nn, state, norm(city)].join('|');
    const teaser = (r.detail && typeof r.detail === 'object') ? r.detail : (typeof r === 'object' ? r : {});
    byId.set(profileId, {
      profile_id: profileId, name, name_norm: nn,
      first_norm: norm(parts[0] || ''), last_norm: norm(parts.length > 1 ? parts[parts.length - 1] : ''),
      city: city || null, state: state || null, age: r.age != null ? String(r.age) : null, teaser,
    });
  }
  const payload = [...byId.values()];
  if (!payload.length) return;
  try {
    await sql`
      INSERT INTO person_profiles (profile_id, name, name_norm, first_norm, last_norm, city, state, age, teaser, search_count, first_seen, last_seen)
      SELECT x.profile_id, x.name, x.name_norm, x.first_norm, x.last_norm, x.city, x.state, x.age, x.teaser, 1, now(), now()
      FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb)
        AS x(profile_id text, name text, name_norm text, first_norm text, last_norm text, city text, state text, age text, teaser jsonb)
      ON CONFLICT (profile_id) DO UPDATE SET
        teaser = EXCLUDED.teaser,
        name = COALESCE(EXCLUDED.name, person_profiles.name),
        age = COALESCE(EXCLUDED.age, person_profiles.age),
        city = COALESCE(EXCLUDED.city, person_profiles.city),
        state = COALESCE(EXCLUDED.state, person_profiles.state),
        search_count = person_profiles.search_count + 1,
        last_seen = now()`;
  } catch { /* best-effort corpus capture */ }
}

/**
 * Insert one search + its result rows. Two round trips (activity, then a single multi-row
 * insert for results via jsonb_to_recordset). Returns the new activity id.
 * @param {object} a
 *   { searcherType, searcherUserId, sessionId, searchType, source, terms, resultCount,
 *     results:[{position,name,age,city,state,location,detail}], ts, ip, userAgent, meta }
 */
export async function insertSearchActivity(a) {
  if (!sql) throw new Error('no search DB configured');
  const terms = a.terms && typeof a.terms === 'object' ? a.terms : {};
  const first = terms.firstName || terms.fName || '';
  const last = terms.lastName || terms.lName || '';
  const nameNorm = norm(`${first} ${last}`);
  const state = terms.state ? String(terms.state).trim().toUpperCase() : null;

  const s = a.searcher && typeof a.searcher === 'object' ? a.searcher : {};
  const searcherName = s.name || null;
  const searcherState = s.state ? String(s.state).trim().toUpperCase() : null;

  const rows = await sql`
    INSERT INTO search_activity
      (searcher_type, searcher_user_id, session_id, search_type, source, terms,
       term_name_norm, term_first, term_last, term_city, term_state, result_count,
       searched_at, ip, user_agent, meta,
       searcher_name, searcher_name_norm, searcher_first, searcher_city, searcher_state)
    VALUES (
      ${a.searcherType || null}, ${a.searcherUserId || null}, ${a.sessionId || null},
      ${a.searchType || null}, ${a.source || null}, ${JSON.stringify(terms)}::jsonb,
      ${nameNorm || null}, ${norm(first) || null}, ${norm(last) || null},
      ${terms.city ? norm(terms.city) : null}, ${state},
      ${Number.isFinite(a.resultCount) ? a.resultCount : (Array.isArray(a.results) ? a.results.length : null)},
      ${a.ts || null}, ${a.ip || null}, ${a.userAgent || null},
      ${JSON.stringify(a.meta && typeof a.meta === 'object' ? a.meta : {})}::jsonb,
      ${searcherName}, ${searcherName ? norm(searcherName) : null}, ${s.firstName || null},
      ${s.city || null}, ${searcherState}
    )
    RETURNING id
  `;
  const activityId = rows[0].id;

  const results = Array.isArray(a.results) ? a.results.slice(0, 50) : [];
  if (results.length) {
    const payload = results.map((r, i) => ({
      position: i,
      name: r.name || null,
      name_norm: norm(r.name) || null,
      age: r.age != null ? String(r.age) : null,
      city: r.city || null,
      state: r.state ? String(r.state).trim().toUpperCase() : null,
      location: r.location || null,
      detail: r.detail && typeof r.detail === 'object' ? r.detail : {},
    }));
    await sql`
      INSERT INTO search_results
        (activity_id, position, name, name_norm, age, city, state, location, detail)
      SELECT ${activityId}, x.position, x.name, x.name_norm, x.age, x.city, x.state, x.location, x.detail
      FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb)
        AS x(position int, name text, name_norm text, age text, city text, state text, location text, detail jsonb)
    `;
  }
  return activityId;
}
