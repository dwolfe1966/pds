// Neon Postgres access for the SEO surface. One module shared by the Next app
// (read queries) and the Node scripts (seed + sweep writes). When no connection
// string is set, `hasDb` is false and lib/data.js falls back to profiles.json —
// so local dev and the current Vercel build keep working until the DB is wired.
import { neon } from '@neondatabase/serverless';

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '';
export const hasDb = !!URL;
const sql = hasDb ? neon(URL) : null;

// --- reads (app) -----------------------------------------------------------
export async function dbGetPerson(id) {
  const rows = await sql`SELECT data FROM profiles WHERE id = ${id} LIMIT 1`;
  return rows[0]?.data ?? null;
}
export async function dbPeopleByName(nameSlug) {
  const rows = await sql`SELECT data FROM profiles WHERE name_slug = ${nameSlug}`;
  return rows.map((r) => r.data);
}
export async function dbNameIndex(limit = 500) {
  // Distinct names with a count, for the /people index + name-hub discovery.
  const rows = await sql`
    SELECT name_slug, first_name, last_name, COUNT(*)::int AS n
    FROM profiles GROUP BY name_slug, first_name, last_name
    ORDER BY n DESC LIMIT ${limit}`;
  return rows.map((r) => ({ slug: r.name_slug, firstName: r.first_name, lastName: r.last_name, count: r.n }));
}
export async function dbSitemapRows(indexableOnly = false) {
  const rows = indexableOnly
    ? await sql`SELECT id, name_slug, state, city_slug FROM profiles WHERE indexable = TRUE`
    : await sql`SELECT id, name_slug, state, city_slug FROM profiles`;
  return rows;
}

// --- writes (scripts) ------------------------------------------------------
export async function dbUpsertProfile(p) {
  const citySlug = String(p.city || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const nameSlug = `${p.firstName}-${p.lastName}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  await sql`
    INSERT INTO profiles (id, name_slug, first_name, last_name, full_name, state, city, city_slug, age, on_record_since, data, updated_at)
    VALUES (${p.id}, ${nameSlug}, ${p.firstName}, ${p.lastName}, ${p.fullName}, ${p.state}, ${p.city}, ${citySlug}, ${p.age ?? null}, ${p.onRecordSince ?? null}, ${JSON.stringify(p)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name, state = EXCLUDED.state, city = EXCLUDED.city,
      city_slug = EXCLUDED.city_slug, age = EXCLUDED.age, on_record_since = EXCLUDED.on_record_since,
      data = EXCLUDED.data, updated_at = now()`;
}
export async function dbLogSweep(nameSlug, state, total, got) {
  await sql`
    INSERT INTO sweep_log (name_slug, state, total, got, swept_at)
    VALUES (${nameSlug}, ${state}, ${total}, ${got}, now())
    ON CONFLICT (name_slug, state) DO UPDATE SET total = EXCLUDED.total, got = EXCLUDED.got, swept_at = now()`;
}
export async function dbSweptSet() {
  const rows = await sql`SELECT name_slug, state FROM sweep_log`;
  return new Set(rows.map((r) => `${r.name_slug}|${r.state}`));
}
export async function dbCount() {
  const rows = await sql`SELECT COUNT(*)::int AS n FROM profiles`;
  return rows[0]?.n ?? 0;
}

export { sql };
