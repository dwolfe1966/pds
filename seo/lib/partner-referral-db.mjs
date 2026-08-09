// Partner-referral store (Rung 5). For records that need a legal/financial REMEDY, not an opt-out form —
// court/criminal → expungement attorney; credit file → credit remediation. We are a REFERRAL layer: we
// capture the member's consented interest + context and hand it to a vetted partner. We do NOT provide legal
// or credit-repair advice. ⚠️ Going live needs owner decisions: which vetted partners, revenue-share terms,
// and a legal review of the disclosures + consent language.
import { neon } from '@neondatabase/serverless';

const URL = process.env.LEADS_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
export const hasReferralDb = !!URL;
const sql = hasReferralDb ? neon(URL) : null;

const TRACKS = new Set(['expungement', 'credit']);

let _ensured = false;
async function ensure() {
  if (_ensured || !sql) return;
  await sql`CREATE TABLE IF NOT EXISTS partner_referral (
    id BIGSERIAL PRIMARY KEY, user_id TEXT NOT NULL, track TEXT NOT NULL,
    name TEXT, email TEXT, phone TEXT, state TEXT, context JSONB,
    consent BOOLEAN NOT NULL DEFAULT false, status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ref_user ON partner_referral(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ref_track_status ON partner_referral(track, status)`;
  _ensured = true;
}

// Create a referral — REQUIRES explicit consent (we share their details with a vetted partner).
export async function createReferral({ userId, track, name, email, phone, state, context, consent }) {
  if (!sql || !userId) return { ok: false, error: 'no_db_or_user' };
  if (!TRACKS.has(track)) return { ok: false, error: 'bad_track' };
  if (consent !== true) return { ok: false, error: 'consent_required' };
  await ensure();
  const rows = await sql`INSERT INTO partner_referral (user_id, track, name, email, phone, state, context, consent, status)
    VALUES (${userId}, ${track}, ${name || null}, ${email || null}, ${phone || null}, ${state || null},
            ${context ? JSON.stringify(context) : null}::jsonb, true, 'new')
    RETURNING id`;
  return { ok: true, id: rows[0] && rows[0].id };
}

// The member's own referrals (status view).
export async function getReferrals(userId) {
  if (!sql || !userId) return [];
  await ensure();
  try { return await sql`SELECT id, track, status, created_at FROM partner_referral WHERE user_id = ${userId} ORDER BY created_at DESC`; }
  catch { return []; }
}
