// First-party inmate roster store (the moat asset). Write-through from live searches + crawls
// (scripts/crawl-state-inmates.mjs), read by the `dbInmates` provider in incarceration.mjs. Schema:
// seo/db/inmates-schema.sql. Same Neon DB as fl_inmates. Never throws — degrades to [] / no-op.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasInmatesDb = !!URL;
const sql = hasInmatesDb ? neon(URL) : null;

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
const idFor = (r) => `${r.state}:${r.source}:${r.inmateId || norm(r.name)}`.toLowerCase();

/** Read cached roster rows for a name+state. Serves the blocked-state fallback + SEO; each row carries
 *  `asOf` (last_crawled) so the display can show freshness. Excludes takedown (`removed`) rows. */
export async function queryInmates({ state, firstName, lastName, limit = 20 }) {
  if (!sql || !lastName || !state) return [];
  const ln = norm(lastName), fn = norm(firstName), st = String(state).toUpperCase();
  let rows;
  try {
    rows = fn
      ? await sql`SELECT * FROM inmates WHERE state = ${st} AND last_norm = ${ln} AND first_norm LIKE ${`${fn}%`} AND removed = FALSE ORDER BY last_crawled DESC LIMIT ${limit}`
      : await sql`SELECT * FROM inmates WHERE state = ${st} AND last_norm = ${ln} AND removed = FALSE ORDER BY last_crawled DESC LIMIT ${limit}`;
  } catch { return []; }
  return rows.map((r) => ({
    source: r.source, sourceName: r.source_name,
    firstName: r.first_name, lastName: r.last_name, name: r.name,
    age: r.age, gender: r.sex, race: r.race,
    charges: Array.isArray(r.charges) ? r.charges : [],
    mugshotUrl: r.mugshot_url, bookingDate: r.booking_date, releaseStatus: r.release_status,
    facility: r.facility, county: r.county, state: r.state, inmateId: r.inmate_id,
    asOf: r.last_crawled, fromCache: true,
  }));
}

/** Write-through upsert of normalized BookingRecords. Batched (one round-trip). Preserves the richest
 *  value on conflict (never nulls out an existing mugshot/charge) + bumps last_crawled. Returns count. */
export async function upsertInmates(records) {
  if (!sql || !records || !records.length) return 0;
  const rows = records.filter((r) => r.state && (r.inmateId || r.name)).map((r) => ({
    id: idFor(r), state: String(r.state).toUpperCase(), source: r.source || null, source_name: r.sourceName || null,
    inmate_id: r.inmateId || null, first_name: r.firstName || null, middle_name: r.middleName || null,
    last_name: r.lastName || null, name: r.name || null, first_norm: norm(r.firstName), last_norm: norm(r.lastName),
    age: Number.isFinite(r.age) ? r.age : null, sex: r.gender || null, race: r.race || null, birth_date: r.birthDate || null,
    facility: r.facility || null, county: r.county || null, release_status: r.releaseStatus || null,
    booking_date: r.bookingDate || null, mugshot_url: r.mugshotUrl || null, charges: r.charges || [],
  }));
  if (!rows.length) return 0;
  try {
    await sql`
      INSERT INTO inmates (id, state, source, source_name, inmate_id, first_name, middle_name, last_name, name,
        first_norm, last_norm, age, sex, race, birth_date, facility, county, release_status, booking_date,
        mugshot_url, charges, last_crawled, updated_at)
      SELECT x.id, x.state, x.source, x.source_name, x.inmate_id, x.first_name, x.middle_name, x.last_name, x.name,
        x.first_norm, x.last_norm, x.age, x.sex, x.race, x.birth_date, x.facility, x.county, x.release_status,
        x.booking_date, x.mugshot_url, x.charges, now(), now()
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS x(
        id text, state text, source text, source_name text, inmate_id text, first_name text, middle_name text,
        last_name text, name text, first_norm text, last_norm text, age int, sex text, race text, birth_date text,
        facility text, county text, release_status text, booking_date text, mugshot_url text, charges jsonb)
      ON CONFLICT (id) DO UPDATE SET
        source_name = COALESCE(EXCLUDED.source_name, inmates.source_name),
        first_name = COALESCE(EXCLUDED.first_name, inmates.first_name),
        last_name = COALESCE(EXCLUDED.last_name, inmates.last_name), name = EXCLUDED.name,
        age = COALESCE(EXCLUDED.age, inmates.age), sex = COALESCE(EXCLUDED.sex, inmates.sex),
        race = COALESCE(EXCLUDED.race, inmates.race),
        facility = COALESCE(EXCLUDED.facility, inmates.facility), county = COALESCE(EXCLUDED.county, inmates.county),
        release_status = COALESCE(EXCLUDED.release_status, inmates.release_status),
        booking_date = COALESCE(EXCLUDED.booking_date, inmates.booking_date),
        mugshot_url = COALESCE(EXCLUDED.mugshot_url, inmates.mugshot_url),
        charges = CASE WHEN jsonb_array_length(EXCLUDED.charges) > 0 THEN EXCLUDED.charges ELSE inmates.charges END,
        last_crawled = now(), updated_at = now()`;
    return rows.length;
  } catch { return 0; }
}

/** Takedown (expungement / opt-out): flag a record removed so it's never served. */
export async function removeInmate(id) {
  if (!sql || !id) return false;
  try { await sql`UPDATE inmates SET removed = TRUE, updated_at = now() WHERE id = ${id}`; return true; } catch { return false; }
}
