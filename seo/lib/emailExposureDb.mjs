// Cache for HIBP email-exposure lookups (Core 1 = 10 req/min; keep us well under it). A repeated check of the
// same email hits Neon instead of re-hitting HIBP. Keyed by a SHA-256 hash of the normalized email — we never
// store the plaintext address in the cache. Breach data is historical (new breaches are infrequent) → medium
// TTL. Never throws: degrades to a cache miss (null) / no-op so a DB blip just means one more HIBP call.
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasExposureCache = !!URL;
const sql = hasExposureCache ? neon(URL) : null;

export const hashEmail = (email) => createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex');

let _ensured = false;
async function ensureTable() {
  if (_ensured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS email_exposure_cache (
      id text PRIMARY KEY,
      breached boolean NOT NULL DEFAULT false,
      breach_count int NOT NULL DEFAULT 0,
      result jsonb NOT NULL DEFAULT '{}'::jsonb,
      fetched_at timestamptz NOT NULL DEFAULT now()
    )`;
    _ensured = true;
  } catch { /* leave unensured — getCached/setCached will just miss */ }
}

/** Cached exposure summary for an email, or null on miss/stale/error. @param maxAgeDays default 180 — breach
 *  data is historical, so we reuse it for a long time to avoid re-paying HIBP (owner 2026-07-25: store & reuse).
 *  A future monitoring job will force-refresh on its own cadence to catch NEW breaches. */
export async function getCachedExposure(email, maxAgeDays = 180) {
  if (!sql || !email) return null;
  await ensureTable();
  try {
    const rows = await sql`SELECT result FROM email_exposure_cache
      WHERE id = ${hashEmail(email)} AND fetched_at > now() - make_interval(days => ${Math.max(1, maxAgeDays)})`;
    if (rows && rows[0] && rows[0].result && typeof rows[0].result === 'object') return rows[0].result;
    return null;
  } catch { return null; }
}

/** Cache the summary (including a clean/no-breach result — a clean check is still a lookup worth not repeating). */
export async function setCachedExposure(email, result) {
  if (!sql || !email || !result) return;
  await ensureTable();
  try {
    await sql`INSERT INTO email_exposure_cache (id, breached, breach_count, result, fetched_at)
      VALUES (${hashEmail(email)}, ${!!result.breached}, ${result.count || 0}, ${JSON.stringify(result)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET breached = EXCLUDED.breached, breach_count = EXCLUDED.breach_count,
        result = EXCLUDED.result, fetched_at = now()`;
  } catch { /* no-op — a cache write miss just means we may re-query HIBP once */ }
}
