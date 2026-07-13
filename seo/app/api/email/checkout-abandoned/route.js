// POST /api/email/checkout-abandoned — the consumer's checkout_abandoned signal lands here.
//
// Under the /api/email/* namespace with the rest of the email-marketing surface. Same
// shape as /api/leads: a Vercel API route + a Neon table (abandoned_checkouts). A Vercel
// Cron job reads the "pending" rows (email present, emailed_at null) and sends the recovery
// email. Setup: run seo/db/abandoned-checkouts-schema.sql once on the Neon DB.
import { insertAbandonedCheckout, hasLeadsDb } from '../../../../lib/leads-db.mjs';

export const runtime = 'nodejs';

const ALLOWED_ORIGINS = new Set([
  'https://www.idlookup.ai',
  'https://idlookup.ai',
  'http://localhost:3000',
]);

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };

  let body;
  try { body = await req.json(); } catch { body = null; }
  if (!body || typeof body !== 'object') {
    return new Response(JSON.stringify({ error: 'bad body' }), { status: 400, headers });
  }
  // email is OPTIONAL — an abandonment is still a useful signal without one; only the
  // recovery-email step needs it. If present, it must look valid.
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'invalid email' }), { status: 400, headers });
  }

  if (!hasLeadsDb) {
    return new Response(JSON.stringify({ ok: true, persisted: false }), { status: 200, headers });
  }

  try {
    await insertAbandonedCheckout({
      email: email || null,
      personId: body.personId,
      offer: body.offer,
      variant: body.variant,
      meta: body.meta,
      ts: body.ts,
      ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
      userAgent: req.headers.get('user-agent') || null,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'persist failed' }), { status: 500, headers });
  }
}
