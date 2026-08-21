// Neon client for the web_events activity log (owner 2026-08-21). Same DB as leads/search-activity
// (LEADS_DATABASE_URL || DATABASE_URL). Schema: seo/db/web-events-schema.sql. Insert is best-effort;
// the API route never blocks the client on it.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasWebEventsDb = !!URL;
const sql = hasWebEventsDb ? neon(URL) : null;

const STATES = new Set(['visitor', 'member', 'paid']);
const str = (v, max = 512) => (v == null ? null : String(v).slice(0, max));

/** Insert one web event. Coerces/caps fields; unknowns land in page_data. Returns the row id or null. */
export async function insertWebEvent(e) {
  if (!sql || !e || !e.event) return null;
  const userState = STATES.has(e.userState) ? e.userState : 'visitor';
  const pageData = e.pageData && typeof e.pageData === 'object' ? e.pageData : {};
  let clientTs = null;
  if (e.clientTs) { const d = new Date(e.clientTs); if (!Number.isNaN(d.getTime())) clientTs = d.toISOString(); }
  const rows = await sql`
    INSERT INTO web_events
      (client_ts, event, user_id, user_state, anon_id, session_id, variant, shn, partner, page, page_data, referrer, user_agent, ip_hash, country)
    VALUES (
      ${clientTs}, ${str(e.event, 120)}, ${str(e.userId, 128)}, ${userState}, ${str(e.anonId, 128)}, ${str(e.sessionId, 128)},
      ${str(e.variant, 120)}, ${str(e.shn, 128)}, ${str(e.partner, 120)}, ${str(e.page, 512)}, ${JSON.stringify(pageData)}::jsonb,
      ${str(e.referrer, 512)}, ${str(e.userAgent, 512)}, ${str(e.ipHash, 128)}, ${str(e.country, 8)})
    RETURNING id`;
  return rows[0] && rows[0].id;
}

/** Funnel counts by variant over the last `days` — for quick A/B analysis. */
export async function funnelByVariant(days = 14) {
  if (!sql) return [];
  return sql`
    SELECT variant, event, count(*)::int AS n, count(DISTINCT session_id)::int AS sessions
    FROM web_events
    WHERE ts > now() - (${days} || ' days')::interval AND variant IS NOT NULL
    GROUP BY variant, event
    ORDER BY variant, n DESC`;
}
