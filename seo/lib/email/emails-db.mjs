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
