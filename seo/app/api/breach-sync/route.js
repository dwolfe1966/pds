// POST /api/breach-sync — on-demand breach sync for a signed-in member opening My Identity. Fetches their
// exposure (cache-first), diffs vs last-known, logs identity_events for new findings, updates monitor state,
// and returns the current exposure + whether anything is new. Auto-enrolls them for the weekly cron.
// Self-check use (the member's own email). See lib/breachSync.mjs.
import { syncBreachExposure } from '../../../lib/breachSync.mjs';

export const runtime = 'nodejs';
export const maxDuration = 20;

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
  if (!email) return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers });
  try {
    const r = await syncBreachExposure({ email, nowIso: new Date().toISOString() });
    return new Response(JSON.stringify(r), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ available: false }), { status: 200, headers });
  }
}
