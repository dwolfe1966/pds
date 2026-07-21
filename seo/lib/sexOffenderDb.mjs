// First-party sex-offender roster store. Write-through from crawls (scripts/crawl-sex-offenders.mjs)
// via NSOPW (lib/sexOffender.mjs); read by the SEO state/city/name surfaces. Schema:
// seo/db/sex-offenders-schema.sql. Same Neon DB as inmates. Never throws — degrades to [] / no-op.
//
// ⚠️ COMPLIANCE: display rights confirmed by owner 2026-07-20, but SO display is legally sensitive. We own
// the takedown obligation once persisted (`removed`) and served rows carry `asOf` (last_crawled) freshness.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasSoDb = !!URL;
const sql = hasSoDb ? neon(URL) : null;

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
const idFor = (r) => `${r.jurisdiction || r.state}:nsopw:${r.offenderId || norm(r.name)}`.toLowerCase();

const toOut = (r) => ({
  source: r.source, sourceName: r.source_name,
  firstName: r.first_name, lastName: r.last_name, name: r.name,
  age: r.age, dob: r.dob, gender: r.gender,
  address: r.address, city: r.city, county: r.county, state: r.state, zip: r.zip,
  latitude: r.latitude, longitude: r.longitude,
  riskLevel: r.risk_level, absconder: r.absconder, photoUrl: r.photo_url, registryUrl: r.registry_url,
  offenses: Array.isArray(r.offenses) ? r.offenses : [], aliases: Array.isArray(r.aliases) ? r.aliases : [],
  offenderId: r.offender_id, jurisdiction: r.jurisdiction, asOf: r.last_crawled, fromCache: true,
});

/** Flexible read: scope by any of state + name (last/first) + county + city. Optional-filter pattern
 *  (a null filter matches everything) so ONE function serves name-in-state, county-hub, and city pages.
 *  Excludes takedowns (`removed`). */
export async function querySexOffenders({ state, firstName, lastName, county, city, limit = 20 } = {}) {
  if (!sql || !state) return [];
  const st = String(state).toUpperCase();
  const ln = lastName ? norm(lastName) : null;
  const fnLike = firstName ? `${norm(firstName)}%` : null;
  const cty = county ? norm(String(county).replace(/\s+county$/i, '')) : null;
  const cityN = city ? norm(city) : null;
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 200);
  try {
    const rows = await sql`
      SELECT * FROM sex_offenders
      WHERE state = ${st} AND removed = FALSE
        AND (${ln}::text    IS NULL OR last_norm = ${ln})
        AND (${fnLike}::text IS NULL OR first_norm LIKE ${fnLike})
        AND (${cty}::text    IS NULL OR county_norm = ${cty})
        AND (${cityN}::text  IS NULL OR city_norm = ${cityN})
      ORDER BY last_crawled DESC LIMIT ${lim}`;
    return rows.map(toOut);
  } catch { return []; }
}

/** Count offenders for a state/county/city grain — powers the aggregate line on state/city pages. */
export async function countSexOffenders({ state, county, city } = {}) {
  if (!sql || !state) return 0;
  const st = String(state).toUpperCase();
  const cty = county ? norm(String(county).replace(/\s+county$/i, '')) : null;
  const cityN = city ? norm(city) : null;
  try {
    const r = await sql`
      SELECT count(*)::int n FROM sex_offenders
      WHERE state = ${st} AND removed = FALSE
        AND (${cty}::text   IS NULL OR county_norm = ${cty})
        AND (${cityN}::text IS NULL OR city_norm = ${cityN})`;
    return r[0]?.n || 0;
  } catch { return 0; }
}

/** Write-through upsert of NSOPW records (lib/sexOffender.mjs toRecord shape). Batched, one round-trip.
 *  Preserves richest value on conflict + bumps last_crawled. Returns count written. */
export async function upsertSexOffenders(records) {
  if (!sql || !records || !records.length) return 0;
  const rows = records.filter((r) => (r.state || r.jurisdiction) && (r.offenderId || r.name)).map((r) => ({
    id: idFor(r), source: r.source || 'nsopw', source_name: r.sourceName || null, offender_id: r.offenderId || null,
    jurisdiction: r.jurisdiction || null, first_name: r.firstName || null, last_name: r.lastName || null, name: r.name || null,
    first_norm: norm(r.firstName), last_norm: norm(r.lastName), age: Number.isFinite(r.age) ? r.age : null,
    dob: r.dob || null, gender: r.gender || null, address: r.address || null, city: r.city || null,
    county: r.county || null, state: String(r.state || r.jurisdiction || '').toUpperCase() || null, zip: r.zip || null,
    city_norm: norm(r.city), county_norm: norm(String(r.county || '').replace(/\s+county$/i, '')),
    latitude: Number.isFinite(r.latitude) ? r.latitude : null, longitude: Number.isFinite(r.longitude) ? r.longitude : null,
    risk_level: r.riskLevel || null, absconder: r.absconder === true, photo_url: r.photoUrl || null,
    registry_url: r.registryUrl || null, offenses: r.offenses || [], aliases: r.aliases || [], locations: r.locations || [],
  }));
  // ON CONFLICT DO UPDATE cannot affect the same id twice in ONE insert — and NSOPW returns the same
  // offender under multiple location entries, so a single name query yields duplicate ids. Dedupe by id
  // (last wins) before the batch, or the whole insert throws and silently writes 0.
  const byId = new Map();
  for (const r of rows) byId.set(r.id, r);
  const deduped = [...byId.values()];
  if (!deduped.length) return 0;
  try {
    await sql`
      INSERT INTO sex_offenders (id, source, source_name, offender_id, jurisdiction, first_name, last_name, name,
        first_norm, last_norm, age, dob, gender, address, city, county, state, zip, city_norm, county_norm,
        latitude, longitude, risk_level, absconder, photo_url, registry_url, offenses, aliases, locations,
        last_crawled, updated_at)
      SELECT x.id, x.source, x.source_name, x.offender_id, x.jurisdiction, x.first_name, x.last_name, x.name,
        x.first_norm, x.last_norm, x.age, x.dob, x.gender, x.address, x.city, x.county, x.state, x.zip, x.city_norm,
        x.county_norm, x.latitude, x.longitude, x.risk_level, x.absconder, x.photo_url, x.registry_url, x.offenses,
        x.aliases, x.locations, now(), now()
      FROM jsonb_to_recordset(${JSON.stringify(deduped)}::jsonb) AS x(
        id text, source text, source_name text, offender_id text, jurisdiction text, first_name text, last_name text,
        name text, first_norm text, last_norm text, age int, dob text, gender text, address text, city text,
        county text, state text, zip text, city_norm text, county_norm text, latitude double precision,
        longitude double precision, risk_level text, absconder boolean, photo_url text, registry_url text,
        offenses jsonb, aliases jsonb, locations jsonb)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, age = COALESCE(EXCLUDED.age, sex_offenders.age),
        dob = COALESCE(EXCLUDED.dob, sex_offenders.dob), gender = COALESCE(EXCLUDED.gender, sex_offenders.gender),
        address = COALESCE(EXCLUDED.address, sex_offenders.address), city = COALESCE(EXCLUDED.city, sex_offenders.city),
        county = COALESCE(EXCLUDED.county, sex_offenders.county), zip = COALESCE(EXCLUDED.zip, sex_offenders.zip),
        city_norm = COALESCE(EXCLUDED.city_norm, sex_offenders.city_norm),
        county_norm = COALESCE(EXCLUDED.county_norm, sex_offenders.county_norm),
        latitude = COALESCE(EXCLUDED.latitude, sex_offenders.latitude),
        longitude = COALESCE(EXCLUDED.longitude, sex_offenders.longitude),
        photo_url = COALESCE(EXCLUDED.photo_url, sex_offenders.photo_url),
        registry_url = COALESCE(EXCLUDED.registry_url, sex_offenders.registry_url),
        aliases = CASE WHEN jsonb_array_length(EXCLUDED.aliases) > 0 THEN EXCLUDED.aliases ELSE sex_offenders.aliases END,
        locations = CASE WHEN jsonb_array_length(EXCLUDED.locations) > 0 THEN EXCLUDED.locations ELSE sex_offenders.locations END,
        last_crawled = now(), updated_at = now()`;
    return deduped.length;
  } catch (e) { return 0; }
}

/** Takedown (opt-out / removal): flag a record so it's never served. */
export async function removeSexOffender(id) {
  if (!sql || !id) return false;
  try { await sql`UPDATE sex_offenders SET removed = TRUE, updated_at = now() WHERE id = ${id}`; return true; } catch { return false; }
}
