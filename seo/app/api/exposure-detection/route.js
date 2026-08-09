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
import { hasExposureDb, getNodeBySource, getSourceRegistry } from '../../../lib/exposure-graph-db.mjs';
import { hasMappedIdentity, hasSearchDb } from '../../../lib/search-activity-db.mjs';
import { addIdentityEvent, addIdentityEventByUserKey } from '../../../lib/identityEventsDb.mjs';
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

  // Defense in depth: a name-only match can't drive a signal — require a 2nd identifier (the extension
  // already enforces element-level co-occurrence, but never trust the client alone).
  const m = (body.matched && typeof body.matched === 'object') ? body.matched : {};
  const strong = !!m.name && !!(m.city || m.state || m.age || m.phone);
  if (!strong) return new Response(JSON.stringify({ ok: true, ignored: 'weak_match' }), { status: 200, headers });

  try {
    // sourceKey must be a real catalog source (host→slug guess from the extension), and we only act on an
    // ACTIVE removal for it — no active removal → nothing to suspect (and no junk node is created).
    const registry = await getSourceRegistry();
    const row = registry.find((r) => r.source_key === String(sourceKey));
    if (!row) return new Response(JSON.stringify({ ok: true, ignored: 'unknown_source' }), { status: 200, headers });

    const nodes = await getNodeBySource(String(userId), String(sourceKey));
    const node = nodes.find((n) => REMOVAL_STATES.has(n.control_status));
    if (!node) return new Response(JSON.stringify({ ok: true, suspected: false }), { status: 200, headers });

    const name = row.display_name || sourceKey;
    const evt = {
      type: 'reappearance_suspected',
      title: `You may be listed on ${name} again`,
      detail: `We spotted what looks like your listing on ${name} after your removal. Re-check it and, if it's back, re-submit your opt-out.`,
      data: { sourceKey: String(sourceKey), displayName: name, optOutUrl: row.opt_out_url || null, source: 'extension' },
      // Once per removal episode: last_changed only moves when the member re-acts, so repeated visits while
      // still in the same removal state collapse to one alert.
      dedupKey: `reappear_suspect:${sourceKey}:${String(node.last_changed).slice(0, 10)}`,
    };
    let logged = false;
    if (node.subject_user_key) logged = await addIdentityEventByUserKey(node.subject_user_key, evt);
    else if (body.email) logged = await addIdentityEvent(body.email, evt);

    return new Response(JSON.stringify({ ok: true, suspected: true, logged }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ error: 'detection failed' }), { status: 500, headers });
  }
}
