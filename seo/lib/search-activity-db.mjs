// Neon client for the search-activity store (WSFY data layer). Same DB as leads/abandoned
// (LEADS_DATABASE_URL || DATABASE_URL). Schema: seo/db/search-activity-schema.sql.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasSearchDb = !!URL;
const sql = hasSearchDb ? neon(URL) : null;

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

  const rows = await sql`
    INSERT INTO search_activity
      (searcher_type, searcher_user_id, session_id, search_type, source, terms,
       term_name_norm, term_first, term_last, term_city, term_state, result_count,
       searched_at, ip, user_agent, meta)
    VALUES (
      ${a.searcherType || null}, ${a.searcherUserId || null}, ${a.sessionId || null},
      ${a.searchType || null}, ${a.source || null}, ${JSON.stringify(terms)}::jsonb,
      ${nameNorm || null}, ${norm(first) || null}, ${norm(last) || null},
      ${terms.city ? norm(terms.city) : null}, ${state},
      ${Number.isFinite(a.resultCount) ? a.resultCount : (Array.isArray(a.results) ? a.results.length : null)},
      ${a.ts || null}, ${a.ip || null}, ${a.userAgent || null},
      ${JSON.stringify(a.meta && typeof a.meta === 'object' ? a.meta : {})}::jsonb
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
