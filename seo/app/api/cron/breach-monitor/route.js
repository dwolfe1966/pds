// GET /api/cron/breach-monitor — Vercel Cron drives weekly breach monitoring. Re-scans enabled members'
// emails against HIBP (force-refresh), diffs vs last-known, and logs identity_events for NEW breaches (which
// then surface in My Activity + the monitoring card + notifications).
//
// Schedule in seo/vercel.json. Secured by CRON_SECRET (Vercel auto-sends `Authorization: Bearer <CRON_SECRET>`).
// Safe to deploy early: if HIBP_API_KEY or the DB is unset it no-ops. Paced under HIBP's rate limit, and
// processes the OLDEST-checked batch each run so frequent short runs cover everyone over the week.
import { listEnabledMonitors } from '../../../../lib/breachMonitorDb.mjs';
import { syncBreachExposure } from '../../../../lib/breachSync.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Batch + pacing keep us under HIBP Core 1 (10 req/min → 1 per 6s). BATCH*DELAY must stay < maxDuration.
const BATCH = Number(process.env.BREACH_MONITOR_BATCH || 8);
const DELAY_MS = Number(process.env.BREACH_MONITOR_DELAY_MS || 6500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (dev) → allow
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 });
  if (!process.env.HIBP_API_KEY) return Response.json({ ok: true, skipped: 'no HIBP_API_KEY' });

  const emails = await listEnabledMonitors(BATCH);
  const now = new Date().toISOString();
  let scanned = 0;
  let newBreaches = 0;
  for (let i = 0; i < emails.length; i++) {
    try {
      const r = await syncBreachExposure({ email: emails[i], forceRefresh: true, nowIso: now });
      scanned += 1;
      newBreaches += (r.newBreaches || []).length;
    } catch { /* skip this member; upsert didn't run, so it stays oldest-checked and retries next run */ }
    if (i < emails.length - 1) await sleep(DELAY_MS);
  }
  return Response.json({ ok: true, scanned, newBreaches });
}
