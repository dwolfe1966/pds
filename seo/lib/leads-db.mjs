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
