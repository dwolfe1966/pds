// POST /api/life-events — first-party life-events lookup for ONE person (divorce + marriage + optional
// sex-offender), returned as one normalized, recordType-tagged list that the report/identity/relationship
// surfaces map onto (docs/design/life-events-data-mapping.md). Keys stay server-side. Independent of BC.
import { findLifeEvents } from '../../../lib/lifeEvents.mjs';

export const runtime = 'nodejs';
// Sex-offender (opt-in) runs a ~10s Browserless flow — give the invocation room.
export const maxDuration = 60;

const ALLOWED_ORIGINS = new Set([
  'https://www.idlookup.ai',
  'https://idlookup.ai',
  'https://dev.www.idlookup.ai',
  'https://idlookup.me',
  'https://www.idlookup.me',
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
    return new Response(JSON.stringify({ error: 'name required', count: 0, records: [] }), { status: 400, headers });
  }
  try {
    const query = {
      firstName: body.firstName ? String(body.firstName).trim() : undefined,
      lastName: body.lastName ? String(body.lastName).trim() : undefined,
      state: body.state ? String(body.state).trim().toUpperCase() : undefined,
      city: body.city ? String(body.city).trim() : undefined,
      age: body.age, gender: body.gender,
      spouseFirstName: body.spouseFirstName,
    };
    // Two modes: nearZips → location-only "offenders near you" (member profile); else name-based life events.
    // sexOffender (name-based) is opt-in (browser-tier + high-stakes).
    const nearZips = Array.isArray(body.nearZips) ? body.nearZips.map((z) => String(z).trim()).filter(Boolean).slice(0, 5) : null;
    const out = await findLifeEvents(query, process.env, { sexOffender: body.sexOffender === true, nearZips });
    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'lookup failed', count: 0, records: [] }), { status: 200, headers });
  }
}
