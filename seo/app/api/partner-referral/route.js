// Partner-referral API (Rung 5) — capture a member's consented interest in an expungement attorney or a
// credit-remediation specialist, and hand it off. Referral only; not legal/credit advice. App-key gated;
// consent required. ⚠️ Live requires vetted partners + revenue terms + legal review (owner).
import { hasReferralDb, createReferral, getReferrals } from '../../../lib/partner-referral-db.mjs';
import { checkAppKey, unauthorized } from '../../../lib/app-auth.mjs';

export const runtime = 'nodejs';

const ALLOWED_ORIGINS = new Set(['https://www.idlookup.ai', 'https://idlookup.ai', 'https://dev.www.idlookup.ai', 'http://localhost:3000']);
function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai';
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Vary': 'Origin' };
}

export async function OPTIONS(req) { return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) }); }

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  let body; try { body = await req.json(); } catch { body = null; }
  if (!body || !body.userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  if (body.consent !== true) return new Response(JSON.stringify({ error: 'consent_required', message: 'Consent is required to share your details with a vetted partner.' }), { status: 400, headers });
  if (!hasReferralDb) return new Response(JSON.stringify({ ok: true, persisted: false }), { status: 200, headers });
  try {
    const res = await createReferral({
      userId: String(body.userId), track: body.track, consent: true,
      name: body.name, email: body.email, phone: body.phone, state: body.state, context: body.context,
    });
    if (!res.ok) return new Response(JSON.stringify({ error: res.error }), { status: 400, headers });
    return new Response(JSON.stringify({ ok: true, id: res.id }), { status: 200, headers });
  } catch { return new Response(JSON.stringify({ error: 'referral failed' }), { status: 500, headers }); }
}

export async function GET(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  if (!hasReferralDb) return new Response(JSON.stringify({ ok: true, referrals: [] }), { status: 200, headers });
  try { return new Response(JSON.stringify({ ok: true, referrals: await getReferrals(String(userId)) }), { status: 200, headers }); }
  catch { return new Response(JSON.stringify({ error: 'read failed' }), { status: 500, headers }); }
}
