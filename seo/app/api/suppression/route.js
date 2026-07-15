// POST /api/suppression — Identity Management "Hide me". A member opts out of OUR surfaces: their
// search activity is hidden from others' WSFY. Body: { userId, name?, state?, on }. App-key gated.
// (External data-broker removal is a separate BC-owned opt-out; we hand that off in the consumer.)
import { setSuppression, isMemberSuppressed, hasSearchDb } from '../../../lib/search-activity-db.mjs';
import { checkAppKey, unauthorized } from '../../../lib/app-auth.mjs';

export const runtime = 'nodejs';

const ALLOWED_ORIGINS = new Set(['https://www.idlookup.ai', 'https://idlookup.ai', 'http://localhost:3000']);
function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
    'Vary': 'Origin',
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function GET(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  if (!hasSearchDb) return new Response(JSON.stringify({ ok: true, suppressed: false }), { status: 200, headers });
  try {
    return new Response(JSON.stringify({ ok: true, suppressed: await isMemberSuppressed(userId) }), { status: 200, headers });
  } catch { return new Response(JSON.stringify({ error: 'read failed' }), { status: 500, headers }); }
}

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  let body;
  try { body = await req.json(); } catch { body = null; }
  if (!body || !body.userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  if (!hasSearchDb) return new Response(JSON.stringify({ ok: true, persisted: false }), { status: 200, headers });
  try {
    await setSuppression({ userId: String(body.userId), name: body.name, state: body.state, on: !!body.on });
    return new Response(JSON.stringify({ ok: true, suppressed: !!body.on }), { status: 200, headers });
  } catch { return new Response(JSON.stringify({ error: 'persist failed' }), { status: 500, headers }); }
}
