// Cache for Twilio phone-intel lookups (line type / carrier) so repeat checks of the same number don't
// re-incur Twilio cost (~$0.008/lookup). Line type + carrier are very stable, so LONG TTL. Keyed by a
// SHA-256 hash of the 10-digit number (no plaintext number stored). Never throws — degrades to a cache miss
// (null) / no-op so a DB blip just means one more Twilio call. Mirrors emailExposureDb / lifeEventsDb.
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasPhoneIntelCache = !!URL;
const sql = hasPhoneIntelCache ? neon(URL) : null;

const hashPhone = (phone) => createHash('sha256').update(String(phone || '').replace(/\D/g, '')).digest('hex');

let _ensured = false;
async function ensureTable() {
  if (_ensured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS phone_intel_cache (
      id text PRIMARY KEY,
      line_type text,
      risk_level text,
      result jsonb NOT NULL DEFAULT '{}'::jsonb,
      fetched_at timestamptz NOT NULL DEFAULT now()
    )`;
    _ensured = true;
  } catch { /* leave unensured — getCached/setCached will just miss */ }
}

/** Cached line-safety result for a number, or null on miss/stale/error. @param maxAgeDays default 180 (line type is stable). */
export async function getCachedPhoneIntel(phone, maxAgeDays = 180) {
  if (!sql || !phone) return null;
  await ensureTable();
  try {
    const rows = await sql`SELECT result FROM phone_intel_cache
      WHERE id = ${hashPhone(phone)} AND fetched_at > now() - make_interval(days => ${Math.max(1, maxAgeDays)})`;
    if (rows && rows[0] && rows[0].result && typeof rows[0].result === 'object') return rows[0].result;
    return null;
  } catch { return null; }
}

/** Cache the result (only cache a real answer — available:true — so a transient failure isn't pinned). */
export async function setCachedPhoneIntel(phone, result) {
  if (!sql || !phone || !result || !result.available) return;
  await ensureTable();
  try {
    await sql`INSERT INTO phone_intel_cache (id, line_type, risk_level, result, fetched_at)
      VALUES (${hashPhone(phone)}, ${result.lineType || null}, ${result.riskLevel || null}, ${JSON.stringify(result)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET line_type = EXCLUDED.line_type, risk_level = EXCLUDED.risk_level,
        result = EXCLUDED.result, fetched_at = now()`;
  } catch { /* no-op — a cache write miss just means we may re-query Twilio once */ }
}
