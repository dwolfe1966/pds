// POST /api/search-activity — the consumer posts a copy of every search (terms + result set)
// here after BC returns. Powers WSFY ("Who's Searching For You"), built by us, independent of
// BC. Phase 1 = ingest only. Setup: run seo/db/search-activity-schema.sql once on Neon.
import { insertSearchActivity, hasSearchDb } from '../../../lib/search-activity-db.mjs';

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
  if (!body || typeof body !== 'object') {
    return new Response(JSON.stringify({ error: 'bad body' }), { status: 400, headers });
  }

  if (!hasSearchDb) {
    return new Response(JSON.stringify({ ok: true, persisted: false }), { status: 200, headers });
  }

  // Shape the incoming result set into the slim row form the DB lib expects. Cap defensively.
  const rawResults = Array.isArray(body.results) ? body.results.slice(0, 50) : [];
  const results = rawResults.map((r) => {
    const o = (r && typeof r === 'object') ? r : {};
    return {
      name: o.name || o.fullName || null,
      age: o.age != null ? o.age : (o.ageRange != null ? o.ageRange : null),
      city: o.city || null,
      state: o.state || null,
      location: o.location || null,
      detail: o, // keep the full adapted object — "as much detail as possible"
    };
  });

  const searcher = (body.searcher && typeof body.searcher === 'object') ? body.searcher : {};

  try {
    const id = await insertSearchActivity({
      searcherType: searcher.type === 'member' ? 'member' : 'anon',
      searcherUserId: searcher.userId || null,
      sessionId: searcher.sessionId || null,
      searchType: body.type || null,
      source: body.source || null,
      terms: body.terms || {},
      resultCount: results.length,
      results,
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
