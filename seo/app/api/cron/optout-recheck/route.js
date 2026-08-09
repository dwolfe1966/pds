// GET /api/cron/optout-recheck — Vercel Cron drives the digital-footprint MONITORING LOOP. Data brokers
// re-list people over time, so a removal that succeeded once silently lapses. This scans the Exposure Graph
// for requested/removed nodes whose re-list window (source_registry.relist_days) has fully elapsed and logs
// an identity_event prompting the member to RE-VERIFY (and re-submit if their listing is back).
//
// HONESTY: this schedules a re-check prompt only — it NEVER asserts a listing has re-appeared. Detecting an
// actual re-appearance requires a real check (the extension-assisted / worker follow-on); that alone may
// write control_status='reappeared'. The cron stays strictly on "time to re-verify."
//
// Reach: the event lands in the member's identity-events stream → surfaces in My Activity (+ the notification
// bell) on their next visit, without needing email (which is paused). Dedup is per re-list WINDOW, so a
// member is reminded once each window, not once ever and not on every run.
//
// Schedule in seo/vercel.json. Secured by CRON_SECRET (Vercel sends `Authorization: Bearer <CRON_SECRET>`).
// Safe to deploy early: if the DB is unset it no-ops.
import { listRemovalsDueForRecheck } from '../../../../lib/exposure-graph-db.mjs';
import { addIdentityEventByUserKey, hasIdentityEvents } from '../../../../lib/identityEventsDb.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = Number(process.env.OPTOUT_RECHECK_BATCH || 200);

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (dev) → allow
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 });
  if (!hasIdentityEvents) return Response.json({ ok: true, skipped: 'no DB' });

  const due = await listRemovalsDueForRecheck(BATCH);
  const now = new Date().toISOString();
  let logged = 0;
  for (const row of due) {
    const name = row.display_name || row.source_key;
    const ok = await addIdentityEventByUserKey(row.user_key, {
      type: 'optout_recheck',
      title: `Time to re-check your ${name} removal`,
      detail: `Data brokers often re-list. Re-verify that you're still removed from ${name} — if your listing is back, re-submit the opt-out.`,
      data: { sourceKey: row.source_key, displayName: name, optOutUrl: row.opt_out_url || null, relistDays: row.relist_days, requestedAt: row.last_changed },
      // One reminder PER elapsed re-list window (window_n increments each window) → never spams, always recurs.
      dedupKey: `recheck:${row.source_key}:w${row.window_n}`,
      nowIso: now,
    });
    if (ok) logged += 1;
  }
  return Response.json({ ok: true, due: due.length, logged });
}
