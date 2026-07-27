// Neon client for the consumer email-lead store. Uses LEADS_DATABASE_URL if set
// (so leads can live in an ISOLATED DB, separate from the public directory's
// `profiles` DB), otherwise falls back to the SEO app's DATABASE_URL.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasLeadsDb = !!URL;
const sql = hasLeadsDb ? neon(URL) : null;

/** Insert one captured email lead. Schema: seo/db/leads-schema.sql. */
export async function insertLead({ email, meta, ts, ip, userAgent }) {
  if (!sql) throw new Error('no leads DB configured');
  const m = meta && typeof meta === 'object' ? meta : {};
  await sql`
    INSERT INTO leads (email, meta, source, variant, captured_at, ip, user_agent)
    VALUES (
      ${email},
      ${JSON.stringify(m)}::jsonb,
      ${m.source || null},
      ${m.variant || null},
      ${ts || null},
      ${ip || null},
      ${userAgent || null}
    )
  `;
}

/** Insert one abandoned-checkout event. Schema: seo/db/abandoned-checkouts-schema.sql. */
export async function insertAbandonedCheckout({ email, personId, offer, variant, meta, ts, ip, userAgent }) {
  if (!sql) throw new Error('no leads DB configured');
  const m = meta && typeof meta === 'object' ? meta : {};
  await sql`
    INSERT INTO abandoned_checkouts (email, person_id, offer, variant, meta, abandoned_at, ip, user_agent)
    VALUES (
      ${email || null},
      ${personId || null},
      ${offer || null},
      ${variant || null},
      ${JSON.stringify(m)}::jsonb,
      ${ts || null},
      ${ip || null},
      ${userAgent || null}
    )
  `;
}

// ── Recovery-email workflow (read by the Vercel cron) ────────────────────────
// Timing (owner 2026-07-13): 1st email 30 min after abandonment, 1 follow-up 24h
// after that. Only rows that (a) have an email and (b) haven't converted are eligible.
// De-dupe by email so a repeat-abandoner isn't emailed twice for the same address.

/**
 * Rows that need their FIRST recovery email: abandoned ≥ `delayMinutes` ago, has an
 * email, not yet emailed, not recovered. Newest row per email wins (carries the target).
 */
export async function getPendingFirstEmail(delayMinutes = 30, limit = 200) {
  if (!sql) throw new Error('no leads DB configured');
  return sql`
    SELECT DISTINCT ON (lower(email)) id, email, person_id, offer, variant, meta, abandoned_at
    FROM abandoned_checkouts
    WHERE email IS NOT NULL
      AND emailed_at IS NULL
      AND recovered_at IS NULL
      AND abandoned_at IS NOT NULL
      AND abandoned_at <= now() - (${delayMinutes} * INTERVAL '1 minute')
    ORDER BY lower(email), abandoned_at DESC
    LIMIT ${limit}
  `;
}

/**
 * Rows that need the single FOLLOW-UP: first email sent ≥ `delayHours` ago, follow-up
 * not yet sent, not recovered.
 */
export async function getPendingFollowup(delayHours = 24, limit = 200) {
  if (!sql) throw new Error('no leads DB configured');
  return sql`
    SELECT DISTINCT ON (lower(email)) id, email, person_id, offer, variant, meta, abandoned_at
    FROM abandoned_checkouts
    WHERE email IS NOT NULL
      AND emailed_at IS NOT NULL
      AND followup_at IS NULL
      AND recovered_at IS NULL
      AND emailed_at <= now() - (${delayHours} * INTERVAL '1 hour')
    ORDER BY lower(email), emailed_at DESC
    LIMIT ${limit}
  `;
}

/** Stamp a send. stage 'first' → emailed_at, stage 'followup' → followup_at. */
export async function markRecoveryEmailed(id, stage) {
  if (!sql) throw new Error('no leads DB configured');
  if (stage === 'followup') {
    await sql`UPDATE abandoned_checkouts SET followup_at = now() WHERE id = ${id}`;
  } else {
    await sql`UPDATE abandoned_checkouts SET emailed_at = now() WHERE id = ${id}`;
  }
}

// ── Lead-list re-engagement drip (read by the lead-reengagement cron) ────────
// Unique, non-suppressed leads with their remarketing progress, so the cron can compute each lead's next
// step. Progress is derived from the shared email_sends log (campaign like 'lead_remarketing_%'), so no new
// per-lead state table is needed. Excludes anyone who finished all 4 steps.
export async function getReengagementCandidates(limit = 1000) {
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT lower(l.email) AS email,
             max(COALESCE(l.captured_at, l.received_at)) AS captured_at,
             (SELECT count(*) FROM email_sends s
                WHERE s.email = lower(l.email) AND s.campaign LIKE 'lead_remarketing_%' AND s.status = 'sent') AS steps_sent,
             (SELECT max(s.sent_at) FROM email_sends s
                WHERE s.email = lower(l.email) AND s.campaign LIKE 'lead_remarketing_%' AND s.status = 'sent') AS last_sent
      FROM leads l
      WHERE l.email IS NOT NULL AND l.email <> ''
        AND lower(l.email) NOT IN (SELECT email FROM email_suppression)
      GROUP BY lower(l.email)
      HAVING (SELECT count(*) FROM email_sends s
                WHERE s.email = lower(l.email) AND s.campaign LIKE 'lead_remarketing_%' AND s.status = 'sent') < 4
      ORDER BY captured_at ASC
      LIMIT ${Math.min(2000, Math.max(1, limit))}`;
    return (rows || []).map((r) => ({
      email: r.email, capturedAt: r.captured_at, stepsSent: Number(r.steps_sent) || 0, lastSentAt: r.last_sent,
    }));
  } catch { return []; }
}
