// POST /api/incarceration — first-party incarceration/booking lookup on the idlookup.me Vercel server
// (keys stay server-side). Powers the inmate (/name/landing/v3) experience: mugshots, charges, facility,
// booking dates. Provider-abstracted (JailBase + UnlimitedCriminalChecks) — see lib/incarceration.mjs.
import { findBookings } from '../../../lib/incarceration.mjs';

export const runtime = 'nodejs';

const ALLOWED_ORIGINS = new Set([
  'https://www.idlookup.ai',
  'https://idlookup.ai',
  'http://localhost:3000',
]);

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai';
  return {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
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
  if (!body || (!body.lastName && !body.firstName)) {
    return new Response(JSON.stringify({ error: 'name required' }), { status: 400, headers });
  }
  try {
    const out = await findBookings({
      firstName: body.firstName ? String(body.firstName).trim() : undefined,
      lastName: body.lastName ? String(body.lastName).trim() : undefined,
      state: body.state ? String(body.state).trim().toUpperCase() : undefined,
      city: body.city ? String(body.city).trim() : undefined,
      age: body.age,
      sourceId: body.sourceId,
    }, process.env);
    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'lookup failed', count: 0, records: [] }), { status: 200, headers });
  }
}
