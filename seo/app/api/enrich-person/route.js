// POST /api/enrich-person — enrich a member's WSFY network from Enformion PersonSearch (relatives +
// address history), writing into member_enrichment so wsfy.mjs can light up shared_relative /
// verified_relative / past_local affinities. Compliance posture:
//   • INTERNAL use only — WSFY emits DERIVED labels ("May be family"), never the raw relatives/cities.
//   • Corroboration-gated — personToEnrichment() writes NOTHING on a weak/ambiguous name-only match,
//     so a stranger's network never poisons a member's signal (advisor 2026-07-17).
//   • Opt-out honored — an opted-out PersonSearch record is never used.
//   • RETENTION GATE — this endpoint PERSISTS third-party data. It is DRY-RUN by default and only
//     writes when ENFORMION_ENRICH_PERSIST=1 is set (flip that ON only after confirming Enformion's
//     agreement permits storing returned data; the free/dev tier may restrict to query-time use).
import { personToEnrichment } from '../../../lib/person-search.mjs';
import { upsertMemberEnrichment, getMemberEnrichment, hasSearchDb } from '../../../lib/search-activity-db.mjs';
import { checkAppKey, unauthorized } from '../../../lib/app-auth.mjs';

export const runtime = 'nodejs';

const ALLOWED_ORIGINS = new Set(['https://www.idlookup.ai', 'https://idlookup.ai', 'http://localhost:3000']);
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
  if (!process.env.ENFORMION_AP_NAME || !process.env.ENFORMION_AP_PASSWORD) {
    return new Response(JSON.stringify({ ok: true, enriched: false, reason: 'not_configured' }), { status: 200, headers });
  }

  let body;
  try { body = await req.json(); } catch { body = null; }
  if (!body || !body.userId || !body.lastName) {
    return new Response(JSON.stringify({ error: 'userId and lastName required' }), { status: 400, headers });
  }

  // Persist only when the retention gate is explicitly on AND the caller isn't forcing a preview.
  const persistAllowed = process.env.ENFORMION_ENRICH_PERSIST === '1';
  const dryRun = body.dryRun === true || !persistAllowed;

  try {
    const userId = String(body.userId);
    // FILL-ONLY (quota + provenance): skip the Enformion call entirely if the member already has BOTH
    // relatives and past_locations — never overwrite BC-sourced (licensed, richer) data, and don't burn
    // a free-tier search (100/mo) re-enriching. Only fill the dimension(s) currently empty.
    let need = { relatives: true, past: true };
    if (hasSearchDb && !dryRun) {
      try {
        const cur = await getMemberEnrichment(userId);
        if (cur) {
          need.relatives = !(Array.isArray(cur.relatives) && cur.relatives.length > 0);
          need.past = !(Array.isArray(cur.past_locations) && cur.past_locations.length > 0);
        }
      } catch { /* row absent — fill both */ }
      if (!need.relatives && !need.past) {
        return new Response(JSON.stringify({ ok: true, enriched: false, reason: 'already_enriched' }), { status: 200, headers });
      }
    }

    const r = await personToEnrichment({
      userId,
      firstName: body.firstName, lastName: body.lastName,
      city: body.city, state: body.state, age: body.age,
    });
    if (!r.ok) {
      // No corroborated, non-opted-out match — write nothing, report why.
      return new Response(JSON.stringify({ ok: true, enriched: false, reason: r.reason }), { status: 200, headers });
    }
    // Counts only in the response — never echo the raw relatives/cities back to the client.
    const preview = {
      matchConfidence: r.person.matchConfidence,
      relativesCount: r.enrichment.relatives.length,
      pastLocationsCount: r.enrichment.pastLocations.length,
    };
    if (dryRun) {
      return new Response(JSON.stringify({ ok: true, enriched: false, dryRun: true, wouldWrite: preview, persistGate: persistAllowed ? 'on' : 'off' }), { status: 200, headers });
    }
    if (!hasSearchDb) {
      return new Response(JSON.stringify({ ok: true, enriched: false, reason: 'no_db', wouldWrite: preview }), { status: 200, headers });
    }
    // Fill-only: pass empty arrays for dimensions already present so the upsert's
    // "CASE WHEN length>0 THEN new ELSE keep" preserves the existing (BC-sourced) values.
    await upsertMemberEnrichment({
      ...r.enrichment,
      relatives: need.relatives ? r.enrichment.relatives : [],
      pastLocations: need.past ? r.enrichment.pastLocations : [],
    });
    return new Response(JSON.stringify({ ok: true, enriched: true, filled: { relatives: need.relatives, past: need.past }, ...preview }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'enrich failed' }), { status: 500, headers });
  }
}
