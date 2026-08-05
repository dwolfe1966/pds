// POST /api/optout — "build the head": run our OWN opt-out for a member across brokers, record status in
// the Exposure Graph. Body { userId, sourceKeys:[...], consent:true, identity:{firstName,lastName,city,state,age} }.
// Gated on app key + a CLAIMED identity + explicit authorized-agent CONSENT. No vendor. See
// docs/product/build-the-head-optout.md.
import {
  hasExposureDb, getSourceRegistry, upsertNode, logExposureEvent, getNodesForSubject, summarizeNodes,
} from '../../../lib/exposure-graph-db.mjs';
import { submitOptOut, controlStatusFor } from '../../../lib/optout/engine.mjs';
import { hasMappedIdentity, hasSearchDb } from '../../../lib/search-activity-db.mjs';
import { checkAppKey, unauthorized } from '../../../lib/app-auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_ORIGINS = new Set(['https://www.idlookup.ai', 'https://idlookup.ai', 'https://dev.www.idlookup.ai', 'http://localhost:3000']);
function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai';
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Vary': 'Origin' };
}
export async function OPTIONS(req) { return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) }); }

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  let body; try { body = await req.json(); } catch { body = null; }
  const userId = body && body.userId;
  const sourceKeys = (body && Array.isArray(body.sourceKeys)) ? body.sourceKeys : [];
  if (!userId || !sourceKeys.length) return new Response(JSON.stringify({ error: 'userId and sourceKeys[] required' }), { status: 400, headers });
  // Authorized-agent consent is REQUIRED to act on someone's behalf.
  if (body.consent !== true) return new Response(JSON.stringify({ error: 'consent_required', message: 'Authorize IDLookup to request removal on your behalf.' }), { status: 400, headers });
  if (!hasExposureDb) return new Response(JSON.stringify({ ok: true, results: [] }), { status: 200, headers });
  // Only act on YOUR OWN footprint (claimed + verified identity).
  if (hasSearchDb && !(await hasMappedIdentity(String(userId)))) {
    return new Response(JSON.stringify({ error: 'identity_unverified', message: 'Claim and verify your identity first.' }), { status: 403, headers });
  }

  const identity = (body.identity && typeof body.identity === 'object') ? body.identity : {};
  try {
    const registry = await getSourceRegistry();
    const byKey = {}; registry.forEach((r) => { byKey[r.source_key] = r; });

    const results = [];
    for (const sourceKey of sourceKeys) {
      const registryRow = byKey[sourceKey];
      const result = await submitOptOut({ sourceKey, registryRow, identity });
      const control = controlStatusFor(result);
      if (control) {
        const nodeId = await upsertNode({
          subjectKey: String(userId), surfaceType: (registryRow && registryRow.surface_type) || 'data_broker',
          sourceKey, foundStatus: 'found', severity: (registryRow && registryRow.weight) || 2,
          controlStatus: control, controlMethod: result.method, syncControl: true,
        });
        await logExposureEvent({ nodeId, subjectKey: String(userId), eventType: 'optout_submitted', method: result.method, detail: { status: result.status, consent: true, ...result.detail } });
      }
      results.push({ sourceKey, method: result.method, status: result.status, detail: result.detail });
    }

    const nodes = await getNodesForSubject(String(userId));
    return new Response(JSON.stringify({ ok: true, results, nodes, summary: summarizeNodes(nodes) }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'optout run failed' }), { status: 500, headers });
  }
}
