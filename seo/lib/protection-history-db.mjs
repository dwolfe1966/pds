// Protection-score history (Neon) — one snapshot per member per day, so the footprint can show a trend of
// how their Identity Protection Score has moved as they act. Keyed by user_id (BC id), same as the exposure
// graph's subject_key. Never throws — degrades to no-op / empty. The score is computed client-side from the
// graph; we just persist the number. Snapshots record the score AS COMPUTED that day (if the score formula
// later changes, past points reflect the old formula — that's fine for a trend).
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasProtectionHistory = !!URL;
const sql = hasProtectionHistory ? neon(URL) : null;

let _ensured = false;
async function ensure() {
  if (_ensured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS protection_snapshot (
      user_id TEXT NOT NULL,
      day DATE NOT NULL DEFAULT current_date,
      score INT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, day)
    )`;
    await sql`CREATE INDEX IF NOT EXISTS idx_protsnap_user ON protection_snapshot(user_id, day)`;
    _ensured = true;
  } catch { /* leave unensured — calls will no-op/miss */ }
}

/** Upsert TODAY's snapshot for the member (latest view of the day wins). */
export async function recordSnapshot(userId, score) {
  if (!sql || !userId) return false;
  const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  await ensure();
  try {
    await sql`INSERT INTO protection_snapshot (user_id, day, score) VALUES (${String(userId)}, current_date, ${s})
      ON CONFLICT (user_id, day) DO UPDATE SET score = EXCLUDED.score, updated_at = now()`;
    return true;
  } catch { return false; }
}

/** Recent snapshots (oldest→newest) for the trend, or [] on miss. */
export async function getSnapshots(userId, limit = 90) {
  if (!sql || !userId) return [];
  await ensure();
  try {
    const rows = await sql`SELECT day, score FROM protection_snapshot WHERE user_id = ${String(userId)}
      ORDER BY day DESC LIMIT ${Math.min(365, Math.max(2, limit))}`;
    return Array.isArray(rows) ? rows.slice().reverse() : [];
  } catch { return []; }
}
