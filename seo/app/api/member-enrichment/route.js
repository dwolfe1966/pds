// POST /api/member-enrichment — landing spot for WSFY Phase 2b enrichment. A member's report-grade
// attributes (occupation, employer, relatives) are resolved by a browser-side BC self-lookup (BC is
// IIFE-only + COGS) and POSTed here → member_enrichment. wsfy.mjs uses them to enrich the tease.
//
// ⚠️ AUTH (interim, same posture as /api/wsfy): body.userId is client-asserted. Before wide use,
// validate the BC token server-side and derive userId from it so a member can only enrich themselves.
import { upsertMemberEnrichment, hasSearchDb } from '../../../lib/search-activity-db.mjs';

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
    'Access-Control-Allow-Headers': 'Content-Type',
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
  if (!body || typeof body !== 'object' || !body.userId) {
    return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  }
  if (!hasSearchDb) {
    return new Response(JSON.stringify({ ok: true, persisted: false }), { status: 200, headers });
  }
  try {
    await upsertMemberEnrichment({
      userId: String(body.userId),
      occupation: body.occupation,
      employer: body.employer,
      relatives: body.relatives,
      city: body.city,
      state: body.state,
      highSchool: body.highSchool,
      college: body.college,
      attributes: body.attributes,
      source: body.source || 'client',
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'persist failed' }), { status: 500, headers });
  }
}
