// POST /api/wsfy — "Who's Searching For You" query. Given a signed-in member's own identity,
// returns a tiered view of who searched for them: FREE = obfuscated tease, PAID = full detail.
// Masking is server-side (buildWsfySummary) — real names never reach a free client.
//
// ⚠️ AUTH (interim): `tier` is asserted by the client. The consumer derives it from BC billing
// (authoritative), but this public endpoint can't yet verify a BC session, so a crafted request
// could assert tier=paid. That leaks the paywalled detail (searcher names), not arbitrary data
// beyond what a paid member sees. HARDENING (before wide launch): validate the caller's BC token
// server-side (identity + paid status) and derive `tier` from that, not from the body. Tracked
// in docs/design/wsfy-self-build.md.
import { buildWsfySummary, hasWsfyDb } from '../../../lib/wsfy.mjs';
import { checkAppKey, unauthorized } from '../../../lib/app-auth.mjs';

export const runtime = 'nodejs';

const ALLOWED_ORIGINS = new Set([
  'https://www.idlookup.ai',
  'https://idlookup.ai',
  'http://localhost:3000',
]);

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
    'Vary': 'Origin',
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);

  let body;
  try { body = await req.json(); } catch { body = null; }
  if (!body || typeof body !== 'object' || !body.name) {
    return new Response(JSON.stringify({ error: 'name required' }), { status: 400, headers });
  }

  if (!hasWsfyDb) {
    return new Response(JSON.stringify({ count: 0, tier: 'free', teaseSummary: { headline: 'No search activity yet', lines: [] }, events: [] }), { status: 200, headers });
  }

  try {
    const summary = await buildWsfySummary(
      { name: body.name, city: body.city, state: body.state, selfUserId: body.selfUserId },
      { tier: body.tier === 'paid' ? 'paid' : 'free' },
    );
    return new Response(JSON.stringify(summary), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'query failed' }), { status: 500, headers });
  }
}
