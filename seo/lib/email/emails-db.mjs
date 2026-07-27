// Email platform data layer — send log + CAN-SPAM suppression. Same Neon as the rest of the growth
// backend. Schema: seo/db/email-schema.sql (email_sends, email_suppression).
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasEmailDb = !!URL;
const sql = hasEmailDb ? neon(URL) : null;

const norm = (e) => String(e || '').trim().toLowerCase();

/** Is this address suppressed (unsubscribed / bounced / complained)? Fail-OPEN=false only if no DB. */
export async function isSuppressed(email) {
  if (!sql) return false;
  try {
    const rows = await sql`SELECT 1 FROM email_suppression WHERE email = ${norm(email)} LIMIT 1`;
    return rows.length > 0;
  } catch { return false; }
}

/** Add an address to the suppression list (idempotent). reason: unsubscribe|bounce|complaint|manual. */
export async function addSuppression(email, reason = 'manual', source = null) {
  if (!sql || !norm(email)) return;
  try {
    await sql`INSERT INTO email_suppression (email, reason, source) VALUES (${norm(email)}, ${reason}, ${source})
              ON CONFLICT (email) DO UPDATE SET reason = EXCLUDED.reason`;
  } catch { /* best-effort */ }
}

/** The full suppression list (for CAN-SPAM + syncing back to BC's transactional stream). */
export async function listSuppression(limit = 5000) {
  if (!sql) return [];
  try {
    const rows = await sql`SELECT email, reason, suppressed_at FROM email_suppression ORDER BY suppressed_at DESC LIMIT ${Math.min(limit, 50000)}`;
    return rows;
  } catch { return []; }
}

/** Record one send attempt (status: sent|suppressed|error). */
export async function logSend({ email, campaign, subject, status, providerId, meta }) {
  if (!sql) return;
  try {
    await sql`INSERT INTO email_sends (email, campaign, subject, status, provider_id, meta)
              VALUES (${norm(email)}, ${campaign || null}, ${subject || null}, ${status || null},
                      ${providerId || null}, ${JSON.stringify(meta && typeof meta === 'object' ? meta : {})}::jsonb)`;
  } catch { /* best-effort */ }
}

// Domain warm-up ramp — the max NEW abandon sends per UTC day. Single source of truth (cron enforces it, the
// status endpoint reports it). ABANDON_DAILY_CAP=N → fixed; ABANDON_RAMP=1 → auto-ramp by day; else 25/day.
export const ABANDON_RAMP_SCHEDULE = [25, 25, 50, 50, 100, 100, 200, 300, 500, 750, 1000];
export async function abandonDailyCap() {
  if (process.env.ABANDON_DAILY_CAP) return Math.max(0, Number(process.env.ABANDON_DAILY_CAP) || 0);
  if (process.env.ABANDON_RAMP === '1') {
    const d = await daysSinceFirstSend('abandoned_%');
    return d == null ? ABANDON_RAMP_SCHEDULE[0] : ABANDON_RAMP_SCHEDULE[Math.min(d, ABANDON_RAMP_SCHEDULE.length - 1)];
  }
  return 25;
}

// Tiny KV for runtime flags (e.g. an instant pause kill-switch that doesn't need a redeploy). Self-creating.
let _kvReady = false;
async function kv() {
  if (!sql) return null;
  if (!_kvReady) {
    try { await sql`CREATE TABLE IF NOT EXISTS email_kv (key text PRIMARY KEY, value text, updated_at timestamptz DEFAULT now())`; _kvReady = true; }
    catch { return null; }
  }
  return sql;
}
export async function getFlag(key) {
  const s = await kv(); if (!s) return null;
  try { const r = await s`SELECT value FROM email_kv WHERE key = ${key} LIMIT 1`; return r[0] ? r[0].value : null; } catch { return null; }
}
export async function setFlag(key, value) {
  const s = await kv(); if (!s) return;
  try { await s`INSERT INTO email_kv (key, value, updated_at) VALUES (${key}, ${String(value)}, now())
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`; } catch { /* best-effort */ }
}

/** Most recent sends (any status) for a campaign family — for the monitoring dashboard. */
export async function recentSends(like = 'abandoned_%', limit = 25) {
  if (!sql) return [];
  try {
    return await sql`SELECT to_char(sent_at, 'MM-DD HH24:MI') AS at, campaign, email, status, left(subject, 60) AS subject, meta
      FROM email_sends WHERE campaign LIKE ${like} ORDER BY sent_at DESC LIMIT ${Math.min(limit, 200)}`;
  } catch { return []; }
}

/** How many sends of campaigns matching `like` went out today (UTC day)? Enforces the daily send cap
 *  across the many cron runs in a day. */
export async function countSentToday(like = 'abandoned_%') {
  if (!sql) return 0;
  try {
    const rows = await sql`SELECT count(*)::int AS n FROM email_sends
      WHERE campaign LIKE ${like} AND status = 'sent' AND sent_at >= date_trunc('day', now())`;
    return (rows[0] && rows[0].n) || 0;
  } catch { return 0; }
}

/** Whole days since the FIRST send of campaigns matching `like` (0 on the first day). null if none yet —
 *  used to index the domain warm-up ramp without needing a hardcoded start date. */
export async function daysSinceFirstSend(like = 'abandoned_%') {
  if (!sql) return null;
  try {
    const rows = await sql`SELECT floor(extract(epoch from (now() - min(sent_at))) / 86400)::int AS d
      FROM email_sends WHERE campaign LIKE ${like} AND status = 'sent'`;
    return rows[0] && rows[0].d != null ? rows[0].d : null;
  } catch { return null; }
}

/** Which of these addresses are suppressed? Batched (one query) so a send batch filters in O(1) round-trips. */
export async function suppressedSet(emails = []) {
  const set = new Set();
  if (!sql || !emails.length) return set;
  try {
    const lowered = [...new Set(emails.map(norm).filter(Boolean))];
    const rows = await sql`SELECT email FROM email_suppression WHERE email = ANY(${lowered})`;
    for (const r of rows) set.add(r.email);
    return set;
  } catch { return set; }
}

/** Has this address already gotten this campaign (dedupe repeat sends)? Optional window in days. */
export async function alreadySent(email, campaign, withinDays = null) {
  if (!sql) return false;
  try {
    const rows = withinDays
      ? await sql`SELECT 1 FROM email_sends WHERE email = ${norm(email)} AND campaign = ${campaign} AND status = 'sent' AND sent_at > now() - (${withinDays} || ' days')::interval LIMIT 1`
      : await sql`SELECT 1 FROM email_sends WHERE email = ${norm(email)} AND campaign = ${campaign} AND status = 'sent' LIMIT 1`;
    return rows.length > 0;
  } catch { return false; }
}
