// Browsing-history sync for the IDLookup extension. Owner decision (2026-08-08): raw history to backend,
// WITH upfront global consent + full delete control. App-key gated; nothing stored without an on-record
// consent; the user can wipe everything (DELETE). ⚠️ Ships with a prominent disclosure + privacy policy.
import { hasHistoryDb, recordConsent, hasConsent, insertVisits, deleteUserHistory, historySummary } from '../../../lib/history-db.mjs';
import { checkAppKey, unauthorized } from '../../../lib/app-auth.mjs';

export const runtime = 'nodejs';

const ALLOWED_ORIGINS = new Set(['https://www.idlookup.ai', 'https://idlookup.ai', 'https://dev.www.idlookup.ai', 'http://localhost:3000']);
function corsHeaders(origin) {
  // Extension requests send Origin like chrome-extension://<id>; allow those + our own origins.
  const isExt = origin && origin.startsWith('chrome-extension://');
  const allow = isExt ? origin : (origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai');
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Vary': 'Origin' };
}

export async function OPTIONS(req) { return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) }); }

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  let body; try { body = await req.json(); } catch { body = null; }
  const userId = body && body.userId;
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  if (!hasHistoryDb) return new Response(JSON.stringify({ ok: true, stored: 0, persisted: false }), { status: 200, headers });
  try {
    // Consent can be (re)set in the same call the extension makes right after the user accepts.
    if (typeof body.setConsent === 'boolean') await recordConsent(String(userId), body.setConsent, body.consentVersion);
    if (!(await hasConsent(String(userId)))) {
      return new Response(JSON.stringify({ error: 'consent_required', message: 'Enable history sync (with consent) first.' }), { status: 403, headers });
    }
    const res = await insertVisits(String(userId), Array.isArray(body.visits) ? body.visits : []);
    return new Response(JSON.stringify({ ok: true, ...res }), { status: 200, headers });
  } catch { return new Response(JSON.stringify({ error: 'store failed' }), { status: 500, headers }); }
}

export async function DELETE(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  if (!hasHistoryDb) return new Response(JSON.stringify({ ok: true, deleted: 0 }), { status: 200, headers });
  try { const res = await deleteUserHistory(String(userId)); return new Response(JSON.stringify({ ok: true, ...res }), { status: 200, headers }); }
  catch { return new Response(JSON.stringify({ error: 'delete failed' }), { status: 500, headers }); }
}

export async function GET(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  if (!hasHistoryDb) return new Response(JSON.stringify({ ok: true, total: 0, topHosts: [], consented: false }), { status: 200, headers });
  try {
    const [summary, consented] = await Promise.all([historySummary(String(userId)), hasConsent(String(userId))]);
    return new Response(JSON.stringify({ ok: true, ...summary, consented }), { status: 200, headers });
  } catch { return new Response(JSON.stringify({ error: 'read failed' }), { status: 500, headers }); }
}
