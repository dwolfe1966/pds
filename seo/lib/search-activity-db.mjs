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
       college, college_norm, attributes, report_id, self_person, past_locations, source, enriched_at)
    VALUES (
      ${e.userId}, ${e.occupation || null}, ${e.employer || null}, ${JSON.stringify(relatives)}::jsonb,
      ${e.city || null}, ${e.state || null}, ${hs}, ${hs ? norm(hs) : null},
      ${col}, ${col ? norm(col) : null}, ${JSON.stringify(attributes)}::jsonb,
      ${e.reportId || null}, ${JSON.stringify(selfPerson)}::jsonb, ${JSON.stringify(pastLocations)}::jsonb, ${e.source || null}, now())
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
      source = EXCLUDED.source, enriched_at = now()
  `;
}

/** Read one member's enrichment (for the cross-device "My Identity" view). */
export async function getMemberEnrichment(userId) {
  if (!sql) throw new Error('no DB configured');
  if (!userId) return null;
  const rows = await sql`
    SELECT user_id, occupation, employer, relatives, city, state, high_school, college,
           report_id, self_person, enriched_at
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
