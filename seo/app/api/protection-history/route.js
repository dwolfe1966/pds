// /api/protection-history — persist + read the member's daily Identity Protection Score snapshots (for the
// footprint trend). POST { userId, score } upserts today; GET ?userId= returns the series (oldest→newest).
// App-key gated. Score is computed client-side from the exposure graph; this just stores the number.
import { hasProtectionHistory, recordSnapshot, getSnapshots } from '../../../lib/protection-history-db.mjs';
import { checkAppKey, unauthorized } from '../../../lib/app-auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  if (!body || !body.userId || typeof body.score !== 'number') return new Response(JSON.stringify({ error: 'userId and numeric score required' }), { status: 400, headers });
  if (!hasProtectionHistory) return new Response(JSON.stringify({ ok: true, persisted: false }), { status: 200, headers });
  const ok = await recordSnapshot(String(body.userId), body.score);
  return new Response(JSON.stringify({ ok }), { status: 200, headers });
}

export async function GET(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  if (!hasProtectionHistory) return new Response(JSON.stringify({ ok: true, snapshots: [] }), { status: 200, headers });
  const snapshots = await getSnapshots(String(userId));
  return new Response(JSON.stringify({ ok: true, snapshots }), { status: 200, headers });
}
