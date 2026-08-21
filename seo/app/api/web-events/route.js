// POST /api/web-events — the consumer pushes every client event here (fire-and-forget from the browser,
// via sendBeacon/keepalive) so we can analyze the funnel BY VARIANT and by lifecycle (visitor/member/paid)
// in a DB we own. Best-effort ingest: always returns quickly; a DB hiccup never surfaces to the client.
// GET (app-key gated) returns a funnel-by-variant rollup for analysis. Setup: run seo/db/web-events-schema.sql once.
import { createHash } from 'node:crypto';
import { insertWebEvent, funnelByVariant, hasWebEventsDb } from '../../../lib/web-events-db.mjs';
import { checkAppKey, unauthorized } from '../../../lib/app-auth.mjs';

export const runtime = 'nodejs';

const ALLOWED_ORIGINS = new Set([
  'https://www.idlookup.ai',
  'https://idlookup.ai',
  'https://dev.www.idlookup.ai',
  'http://localhost:3000',
]);

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai';
  return {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
    'Vary': 'Origin',
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

function hashIp(ip) {
  if (!ip) return null;
  const salt = process.env.WEB_EVENTS_SALT || process.env.WSFY_APP_KEY || 'idl';
  return createHash('sha256').update(`${ip}|${salt}`).digest('hex').slice(0, 32);
}

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  let body;
  try { body = await req.json(); } catch { body = null; }
  if (!body || typeof body !== 'object' || !body.event) {
    return new Response(JSON.stringify({ error: 'bad body' }), { status: 400, headers });
  }
  if (!hasWebEventsDb) return new Response(JSON.stringify({ ok: true, persisted: false }), { status: 200, headers });

  const fwd = req.headers.get('x-forwarded-for') || '';
  const ip = fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || '';

  try {
    await insertWebEvent({
      event: body.event,
      userId: body.userId || null,
      userState: body.userState,
      anonId: body.anonId || null,
      sessionId: body.sessionId || null,
      variant: body.variant || null,
      shn: body.shn || null,
      partner: body.partner || null,
      page: body.page || null,
      pageData: body.pageData || body.data || {},
      clientTs: body.clientTs || body.ts || null,
      referrer: body.referrer || req.headers.get('referer') || null,
      userAgent: req.headers.get('user-agent') || null,
      ipHash: hashIp(ip),
      country: req.headers.get('x-vercel-ip-country') || null,
    });
  } catch { /* best-effort — never fail the beacon */ }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

// GET /api/web-events?days=14 — funnel-by-variant rollup (app-key gated; aggregate, no PII).
export async function GET(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  const days = Math.min(90, Math.max(1, parseInt(new URL(req.url).searchParams.get('days') || '14', 10)));
  if (!hasWebEventsDb) return new Response(JSON.stringify({ ok: true, rows: [] }), { status: 200, headers });
  try {
    return new Response(JSON.stringify({ ok: true, days, rows: await funnelByVariant(days) }), { status: 200, headers });
  } catch { return new Response(JSON.stringify({ error: 'read failed' }), { status: 500, headers }); }
}
