// POST /api/identity-events — recent identity events for a member (breach alerts now; more event kinds
// later). Feeds My Activity + the monitoring card. Keyed server-side by SHA-256(email). See lib/identityEventsDb.mjs.
import { getIdentityEvents } from '../../../lib/identityEventsDb.mjs';

export const runtime = 'nodejs';
export const maxDuration = 10;

const ALLOWED_ORIGINS = new Set([
  'https://www.idlookup.ai', 'https://idlookup.ai', 'https://dev.www.idlookup.ai',
  'https://idlookup.me', 'https://www.idlookup.me', 'http://localhost:3000', 'http://localhost:3010',
]);
function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai';
  return { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Vary': 'Origin' };
}
export async function OPTIONS(req) { return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) }); }

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  let body; try { body = await req.json(); } catch { body = null; }
  const email = body && body.email;
  if (!email) return new Response(JSON.stringify({ events: [] }), { status: 200, headers });
  try {
    const events = await getIdentityEvents(email, body.limit || 50);
    return new Response(JSON.stringify({ events }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ events: [] }), { status: 200, headers });
  }
}
