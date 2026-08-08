// POST /api/member-enrichment — landing spot for WSFY Phase 2b enrichment. A member's report-grade
// attributes (occupation, employer, relatives) are resolved by a browser-side BC self-lookup (BC is
// IIFE-only + COGS) and POSTed here → member_enrichment. wsfy.mjs uses them to enrich the tease.
//
// ⚠️ AUTH (interim, same posture as /api/wsfy): body.userId is client-asserted. Before wide use,
// validate the BC token server-side and derive userId from it so a member can only enrich themselves.
import { upsertMemberEnrichment, getMemberEnrichment, hasSearchDb } from '../../../lib/search-activity-db.mjs';
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
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
    'Vary': 'Origin',
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

// GET /api/member-enrichment?userId=... — cross-device read of the member's mapped identity.
export async function GET(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  const userId = new URL(req.url).searchParams.get('userId');
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  if (!hasSearchDb) return new Response(JSON.stringify({ ok: true, identity: null }), { status: 200, headers });
  try {
    const r = await getMemberEnrichment(userId);
    const sp = (r && r.self_person && typeof r.self_person === 'object') ? r.self_person : {};
    const attr = (r && r.attributes && typeof r.attributes === 'object') ? r.attributes : {};
    const identity = r ? {
      confirmed: true,
      name: sp.name || null,
      age: sp.age || null,
      city: r.city || null,
      state: r.state || null,
      // Removal-profile fields live in the attributes bag (no schema change). Server is the source of truth;
      // captured once on My Identity, read by the opt-out guide + extension.
      address: attr.address || null,
      dob: attr.dob || null,
      phone: attr.phone || null,
      prevAddress: attr.prevAddress || null,
      occupation: r.occupation || null,
      employer: r.employer || null,
      highSchool: r.high_school || null,
      college: r.college || null,
      relativesCount: Array.isArray(r.relatives) ? r.relatives.length : null,
      pastLocationsCount: Array.isArray(r.past_locations) ? r.past_locations.length : null,
      hasReport: !!r.report_id,
      verified: r.verified_level || null,
      mappedAt: r.enriched_at || null,
    } : null;
    return new Response(JSON.stringify({ ok: true, identity }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'read failed' }), { status: 500, headers });
  }
}

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);

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
      reportId: body.reportId,
      selfPerson: body.selfPerson,
      pastLocations: body.pastLocations,
      verified: body.verified,
      source: body.source || 'client',
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'persist failed' }), { status: 500, headers });
  }
}
