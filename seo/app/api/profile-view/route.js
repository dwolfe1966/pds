// POST /api/profile-view — the consumer posts a profile-view event when a member opens a person's
// full profile/report (higher intent than a search). Feeds the "who viewed my profile" reverse-join
// in buildWsfySummary. Ingest-only + best-effort (same open posture as /api/search-activity POST).
import { insertProfileView, hasSearchDb } from '../../../lib/search-activity-db.mjs';

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
  if (!body || typeof body !== 'object' || !body.subject) {
    return new Response(JSON.stringify({ error: 'subject required' }), { status: 400, headers });
  }
  if (!hasSearchDb) {
    return new Response(JSON.stringify({ ok: true, persisted: false }), { status: 200, headers });
  }
  const viewer = (body.viewer && typeof body.viewer === 'object') ? body.viewer : {};
  try {
    const id = await insertProfileView({
      viewerType: viewer.type === 'member' ? 'member' : 'anon',
      viewerUserId: viewer.userId || null,
      sessionId: viewer.sessionId || null,
      viewer, // name/firstName/city/state for member viewers
      subject: body.subject, // { profileId, name, first, last, state } of the person viewed
      source: body.source || null,
      ts: body.ts || null,
      ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
      userAgent: req.headers.get('user-agent') || null,
      meta: body.meta || {},
    });
    return new Response(JSON.stringify({ ok: true, id }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'persist failed' }), { status: 500, headers });
  }
}
