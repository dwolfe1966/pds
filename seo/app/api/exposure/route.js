// /api/exposure — the Exposure Graph read/act endpoint (digital-footprint spine).
// GET  ?userId=&email=  → federates the columns we already own (IDLookup suppression state + breach
//                          monitor) into exposure_node, then returns { nodes, registry, summary }.
// POST { userId, nodeId, controlStatus }  → record a per-node control change (intent) + event. The
//   real removal-engine routing (Optery/OneRep/our-head/manual) plugs in behind this later.
// App-key gated like /api/suppression. Vendor-agnostic: picking/swapping a removal engine never
// touches this route. See docs/product/exposure-graph-spine.md.
import {
  hasExposureDb, seedSourceRegistry, getSourceRegistry, getNodesForSubject,
  upsertNode, setNodeControl, summarizeNodes,
  addAnnotation, getAnnotationsForSubject, deleteAnnotation,
} from '../../../lib/exposure-graph-db.mjs';
import { getSuppressionState, hasMappedIdentity, hasSearchDb } from '../../../lib/search-activity-db.mjs';
import { getMonitorState } from '../../../lib/breachMonitorDb.mjs';
import { checkAppKey, unauthorized } from '../../../lib/app-auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ORIGINS = new Set(['https://www.idlookup.ai', 'https://idlookup.ai', 'https://dev.www.idlookup.ai', 'http://localhost:3000']);
function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai';
  return { 'Access-Control-Allow-Origin': allow, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Vary': 'Origin' };
}
export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// Federate the surfaces we already hold into exposure_node (idempotent upserts).
async function federateOwned({ userId, email }) {
  // IDLookup — one node, control state from the member's suppression.
  if (hasSearchDb) {
    try {
      const s = await getSuppressionState(userId);
      const hidden = s && s.activityHidden;
      await upsertNode({
        subjectKey: userId, surfaceType: 'idlookup', sourceKey: 'idlookup', foundStatus: 'found',
        dataTypes: ['name', 'address', 'relatives', 'records'], severity: 3,
        controlStatus: hidden ? 'hidden' : 'none', controlMethod: 'our_suppression',
        exposureDetail: { hiddenFields: (s && s.hiddenFields) || [] },
        syncControl: true, // IDLookup control state IS the suppression flag — re-sync each federation
      });
    } catch { /* best-effort */ }
  }
  // Breaches — one node per known breach for the member's monitored email.
  if (email) {
    try {
      const mon = await getMonitorState(email);
      if (mon && mon.lastCount > 0 && Array.isArray(mon.lastNames)) {
        for (const name of mon.lastNames) {
          await upsertNode({
            subjectKey: userId, surfaceType: 'breach', sourceKey: `breach:${slug(name)}`, foundStatus: 'found',
            dataTypes: ['email', 'password'], severity: 2, controlStatus: 'none', controlMethod: 'owner',
            exposureDetail: { breach: name },
          });
        }
      }
    } catch { /* best-effort */ }
  }
}

export async function GET(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  const params = new URL(req.url).searchParams;
  const userId = params.get('userId');
  const email = params.get('email');
  if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  if (!hasExposureDb) return new Response(JSON.stringify({ ok: true, nodes: [], registry: [], summary: summarizeNodes([]) }), { status: 200, headers });
  try {
    await seedSourceRegistry();
    await federateOwned({ userId, email });
    const [nodes, registry, annotations] = await Promise.all([getNodesForSubject(userId), getSourceRegistry(), getAnnotationsForSubject(userId)]);
    return new Response(JSON.stringify({ ok: true, nodes, registry, annotations, summary: summarizeNodes(nodes) }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'read failed' }), { status: 500, headers });
  }
}

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  let body; try { body = await req.json(); } catch { body = null; }
  if (!body || !body.userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers });
  if (!hasExposureDb) return new Response(JSON.stringify({ ok: true, persisted: false }), { status: 200, headers });
  // Same gate as suppression: you can only act on YOUR OWN footprint/records (claimed + verified identity).
  // CEILING: userId is client-asserted (app-key only) until WSFY auth-hardening.
  if (hasSearchDb && !(await hasMappedIdentity(String(body.userId)))) {
    return new Response(JSON.stringify({ error: 'identity_unverified', message: 'Claim and verify your identity to control your exposure.' }), { status: 403, headers });
  }
  const userId = String(body.userId);
  try {
    // Owner Voice — add/remove the owner's context on a record/exposure.
    if (body.action === 'annotate') {
      if (!body.note) return new Response(JSON.stringify({ error: 'note required' }), { status: 400, headers });
      const result = await addAnnotation({ subjectKey: userId, nodeId: body.nodeId || null, recordKey: body.recordKey || null, label: body.label || null, note: String(body.note) });
      const annotations = await getAnnotationsForSubject(userId);
      return new Response(JSON.stringify({ ok: result.status !== 'rejected' && result.status !== 'error', moderation: { status: result.status, reason: result.reason }, annotations }), { status: 200, headers });
    }
    if (body.action === 'delete_annotation') {
      if (!body.id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers });
      await deleteAnnotation({ subjectKey: userId, id: body.id });
      const annotations = await getAnnotationsForSubject(userId);
      return new Response(JSON.stringify({ ok: true, annotations }), { status: 200, headers });
    }
    // Control change — act on an existing node (nodeId) OR a catalog source with no node yet
    // (sourceKey+surfaceType — e.g. clicked "Remove" on Spokeo before any scan → create + mark it).
    if (!body.controlStatus || !(body.nodeId || (body.sourceKey && body.surfaceType))) {
      return new Response(JSON.stringify({ error: 'controlStatus and (nodeId | sourceKey+surfaceType) required' }), { status: 400, headers });
    }
    let ok = false;
    if (body.nodeId) {
      ok = await setNodeControl(body.nodeId, {
        subjectKey: String(body.userId), controlStatus: String(body.controlStatus),
        controlMethod: body.controlMethod || null, externalRef: body.externalRef || null,
        eventType: body.eventType || 'control_changed', detail: body.detail || null,
      });
    } else {
      const id = await upsertNode({
        subjectKey: String(body.userId), surfaceType: String(body.surfaceType), sourceKey: String(body.sourceKey),
        foundStatus: 'found', severity: body.severity ?? 2, controlStatus: String(body.controlStatus),
        controlMethod: body.controlMethod || 'manual', syncControl: true,
      });
      if (id) { await setNodeControl(id, { subjectKey: String(body.userId), controlStatus: String(body.controlStatus), controlMethod: body.controlMethod || 'manual', eventType: body.eventType || 'optout_submitted' }); ok = true; }
    }
    const nodes = await getNodesForSubject(String(body.userId));
    return new Response(JSON.stringify({ ok, nodes, summary: summarizeNodes(nodes) }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'write failed' }), { status: 500, headers });
  }
}
