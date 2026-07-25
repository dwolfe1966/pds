// Breach-monitor state (Neon): the last-known breach set per monitored member, so a scan (on-demand or the
// weekly cron) can DIFF against it to detect NEW breaches. Stores the plaintext email because a re-scan must
// re-query HIBP with the real address (member's own email, auto-enrolled when they open My Identity). Never
// throws — degrades to null/no-op. Keyed by user_key = SHA-256(email).
import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasBreachMonitor = !!URL;
const sql = hasBreachMonitor ? neon(URL) : null;

const key = (email) => createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex');

let _ensured = false;
async function ensureTable() {
  if (_ensured || !sql) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS breach_monitor (
      user_key text PRIMARY KEY,
      email text NOT NULL,
      last_names jsonb NOT NULL DEFAULT '[]'::jsonb,
      last_count int NOT NULL DEFAULT 0,
      enabled boolean NOT NULL DEFAULT true,
      last_checked timestamptz NOT NULL DEFAULT now()
    )`;
    _ensured = true;
  } catch { /* leave unensured — get/upsert will just miss/no-op */ }
}

/** Last-known state for a monitored email, or null. { lastNames:[], lastCount, enabled, lastChecked } */
export async function getMonitorState(email) {
  if (!sql || !email) return null;
  await ensureTable();
  try {
    const rows = await sql`SELECT last_names, last_count, enabled, last_checked FROM breach_monitor WHERE user_key = ${key(email)}`;
    if (rows && rows[0]) {
      return {
        lastNames: Array.isArray(rows[0].last_names) ? rows[0].last_names : [],
        lastCount: rows[0].last_count || 0,
        enabled: rows[0].enabled !== false,
        lastChecked: rows[0].last_checked || null,
      };
    }
    return null;
  } catch { return null; }
}

/** Upsert the last-known state after a scan. Pass nowIso for the scan timestamp (defaults to server now()). */
export async function upsertMonitorState(email, { names = [], count = 0, enabled = true, nowIso } = {}) {
  if (!sql || !email) return;
  await ensureTable();
  try {
    await sql`INSERT INTO breach_monitor (user_key, email, last_names, last_count, enabled, last_checked)
      VALUES (${key(email)}, ${String(email).trim().toLowerCase()}, ${JSON.stringify(names)}::jsonb, ${count}, ${enabled},
        COALESCE(${nowIso || null}::timestamptz, now()))
      ON CONFLICT (user_key) DO UPDATE SET last_names = EXCLUDED.last_names, last_count = EXCLUDED.last_count,
        enabled = EXCLUDED.enabled, last_checked = EXCLUDED.last_checked`;
  } catch { /* no-op */ }
}

/** Set the enabled flag (pause/resume monitoring) without touching the breach state. */
export async function setMonitorEnabled(email, enabled) {
  if (!sql || !email) return;
  await ensureTable();
  try {
    await sql`UPDATE breach_monitor SET enabled = ${!!enabled} WHERE user_key = ${key(email)}`;
  } catch { /* no-op */ }
}

/** Enabled monitors for the scheduled scan (returns plaintext emails). Ordered oldest-checked first. */
export async function listEnabledMonitors(limit = 500) {
  if (!sql) return [];
  await ensureTable();
  try {
    const rows = await sql`SELECT email FROM breach_monitor WHERE enabled = true
      ORDER BY last_checked ASC LIMIT ${Math.min(2000, Math.max(1, limit))}`;
    return Array.isArray(rows) ? rows.map((r) => r.email).filter(Boolean) : [];
  } catch { return []; }
}
