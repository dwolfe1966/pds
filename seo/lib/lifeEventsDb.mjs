// Person-keyed cache for PAID life-events lookups (Enformion divorce/marriage $0.05-$0.10/match). A repeated
// name+state search hits Neon instead of re-billing Enformion — bounds the pre-signup-teaser cost (the cost-
// control principle in docs/design/life-events-data-mapping.md). Marriage/divorce records change rarely → long TTL.
// Never throws — degrades to a cache miss (null) / no-op so a DB blip just means we pay Enformion that once.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasLifeEventsCache = !!URL;
const sql = hasLifeEventsCache ? neon(URL) : null;

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const keyFor = (recordType, q) => `${recordType}:${norm(q.firstName)}:${norm(q.lastName)}:${norm(q.state)}`;

let _ensured = false;
async function ensureTable() {
  if (_ensured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS life_events_cache (
      id text PRIMARY KEY,
      record_type text NOT NULL,
      query_first text, query_last text, query_state text,
      records jsonb NOT NULL DEFAULT '[]'::jsonb,
      record_count int NOT NULL DEFAULT 0,
      fetched_at timestamptz NOT NULL DEFAULT now()
    )`;
    _ensured = true;
  } catch { /* leave unensured — getCached/setCached will just miss */ }
}

/** Cached records for a recordType + name+state query, or null on miss/stale/error. @param maxAgeDays default 60. */
export async function getCachedLifeEvents(recordType, query, maxAgeDays = 60) {
  if (!sql || !query || (!query.lastName && !query.firstName)) return null;
  await ensureTable();
  try {
    const rows = await sql`SELECT records FROM life_events_cache
      WHERE id = ${keyFor(recordType, query)} AND fetched_at > now() - make_interval(days => ${Math.max(1, maxAgeDays)})`;
    if (rows && rows[0]) return Array.isArray(rows[0].records) ? rows[0].records : [];
    return null;
  } catch { return null; }
}

/** Cache the result set (including an empty result — an empty search is still a paid call worth not repeating). */
export async function setCachedLifeEvents(recordType, query, records) {
  if (!sql || !query || (!query.lastName && !query.firstName)) return;
  await ensureTable();
  try {
    const recs = Array.isArray(records) ? records : [];
    await sql`INSERT INTO life_events_cache (id, record_type, query_first, query_last, query_state, records, record_count, fetched_at)
      VALUES (${keyFor(recordType, query)}, ${recordType}, ${query.firstName || null}, ${query.lastName || null}, ${query.state || null}, ${JSON.stringify(recs)}::jsonb, ${recs.length}, now())
      ON CONFLICT (id) DO UPDATE SET records = EXCLUDED.records, record_count = EXCLUDED.record_count, fetched_at = now()`;
  } catch { /* no-op */ }
}
