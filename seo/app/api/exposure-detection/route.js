// POST /api/exposure-detection — the browser extension's first-party reappearance signal. When the member
// is on a data broker they've OPTED OUT OF and the extension finds their identity in a listing card (name
// co-occurring with a 2nd identifier — see extension/content.js), it reports it here.
//
// HONESTY: this SUSPECTS a reappearance, it does not assert one. A DOM match on a page the member navigated
// to (the re-check flow sends them there) is evidence, not proof — the broker's results page echoes the
// searched name regardless. So we log a member-confirmable "we may have spotted you again" event and leave
// control_status untouched; the member re-verifies + re-submits. (Auto-flip to control_status='reappeared'
// waits on a confirmation UI.) Reach: the event surfaces in the notification bell + My Activity.
//
// Gated on app key + a CLAIMED identity. Only acts when the member has an ACTIVE removal for that source
// (extension already scopes reporting to opted-out sources; this is defense in depth). Vendor-agnostic.
import { hasExposureDb, getNodeBySource, getSourceRegistry, upsertNode } from '../../../lib/exposure-graph-db.mjs';
import { hasMappedIdentity, hasSearchDb } from '../../../lib/search-activity-db.mjs';
import { addIdentityEvent, addIdentityEventByUserKey, userKey } from '../../../lib/identityEventsDb.mjs';
import { checkAppKey, unauthorized } from '../../../lib/app-auth.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REMOVAL_STATES = new Set(['optout_requested', 'removed', 'optout_confirmed']);

function corsHeaders(origin) {
  // The service worker (chrome-extension origin, granted host_permissions) doesn't need CORS; keep permissive
  // for the app origins that may also call it. No credentials.
  return { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-App-Key', 'Vary': 'Origin' };
}
export async function OPTIONS(req) { return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) }); }

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  if (!checkAppKey(req)) return unauthorized(headers);
  let body; try { body = await req.json(); } catch { body = null; }
  const userId = body && body.userId;
  const sourceKey = body && body.sourceKey;
  if (!userId || !sourceKey) return new Response(JSON.stringify({ error: 'userId and sourceKey required' }), { status: 400, headers });
  if (!hasExposureDb) return new Response(JSON.stringify({ ok: true, persisted: false }), { status: 200, headers });
  if (hasSearchDb && !(await hasMappedIdentity(String(userId)))) {
    return new Response(JSON.stringify({ error: 'identity_unverified' }), { status: 403, headers });
  }

  // Two symmetric signals from the in-session scan:
  //   'present' — the member's listing was FOUND (element-level match) → suspect a REAPPEARANCE.
  //   'absent'  — the member searched themselves and the listing was NOT found → suspect a completed REMOVAL.
  const signal = body.signal === 'absent' ? 'absent' : 'present';
  const m = (body.matched && typeof body.matched === 'object') ? body.matched : {};
  if (signal === 'present') {
    // Defense in depth: a name-only match can't drive a signal — require a 2nd identifier (the extension
    // enforces element-level co-occurrence, but never trust the client alone).
    const strong = !!m.name && !!(m.city || m.state || m.age || m.phone);
    if (!strong) return new Response(JSON.stringify({ ok: true, ignored: 'weak_match' }), { status: 200, headers });
  } else if (!body.context) {
    // Absence is only meaningful if we know a search for THIS person actually happened (name in URL/input,
    // or an explicit "no results"). Without that, a bare homepage visit would falsely read as "removed".
    return new Response(JSON.stringify({ ok: true, ignored: 'no_search_context' }), { status: 200, headers });
  }

  try {
    // sourceKey must be a real catalog source (host→slug guess from the extension), and we only act on an
    // ACTIVE removal for it — no active removal → nothing to suspect (and no junk node is created).
    const registry = await getSourceRegistry();
    const row = registry.find((r) => r.source_key === String(sourceKey));
    if (!row) return new Response(JSON.stringify({ ok: true, ignored: 'unknown_source' }), { status: 200, headers });

    const nodes = await getNodeBySource(String(userId), String(sourceKey));
    const name = row.display_name || sourceKey;

    let evt = null;
    let node = null;
    if (signal === 'present') {
      // Reappearance: relevant to any removal-state node (requested/removed/confirmed).
      node = nodes.find((n) => REMOVAL_STATES.has(n.control_status));
      if (node) {
        evt = {
          type: 'reappearance_suspected',
          title: `You may be listed on ${name} again`,
          detail: `We spotted what looks like your listing on ${name} after your removal. Re-check it and, if it's back, re-submit your opt-out.`,
          data: { sourceKey: String(sourceKey), displayName: name, optOutUrl: row.opt_out_url || null, source: 'extension' },
          dedupKey: `reappear_suspect:${sourceKey}:${String(node.last_changed).slice(0, 10)}`,
        };
      } else {
        // DISCOVERY: found on a broker with no active removal → record the exposure so the footprint reflects
        // where the member actually appears. The strong element-level match (name + a 2nd identifier in one
        // listing card) is the safeguard; found_status='found', control preserved, medium confidence (a
        // first-party in-session scan, not a vendor). This is the "find where I'm exposed" payoff.
        const already = nodes.find((n) => n.found_status === 'found');
        const id = await upsertNode({
          subjectKey: String(userId), surfaceType: row.surface_type || 'data_broker', sourceKey: String(sourceKey),
          foundStatus: 'found', confidence: 'medium', severity: row.weight || 2,
          subjectUserKey: body.email ? userKey(body.email) : null,
        });
        return new Response(JSON.stringify({ ok: true, discovered: !!id && !already, exposed: true }), { status: 200, headers });
      }
    } else {
      // Completion: only relevant while the removal is still pending or had re-appeared (not already 'removed').
      node = nodes.find((n) => n.control_status === 'optout_requested' || n.control_status === 'reappeared');
      if (node) evt = {
        type: 'removal_verified_suspected',
        title: `You may no longer be listed on ${name}`,
        detail: `We didn't find your listing on ${name} after your opt-out. If that looks right, mark it removed — we'll keep monitoring for re-listings.`,
        data: { sourceKey: String(sourceKey), displayName: name, optOutUrl: row.opt_out_url || null, source: 'extension' },
        dedupKey: `removed_suspect:${sourceKey}:${String(node.last_changed).slice(0, 10)}`,
      };
    }
    if (!node || !evt) return new Response(JSON.stringify({ ok: true, suspected: false }), { status: 200, headers });

    let logged = false;
    if (node.subject_user_key) logged = await addIdentityEventByUserKey(node.subject_user_key, evt);
    else if (body.email) logged = await addIdentityEvent(body.email, evt);

    return new Response(JSON.stringify({ ok: true, suspected: true, signal, logged }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'detection failed' }), { status: 500, headers });
  }
}
