// GET /api/cron/lead-reengagement — Vercel Cron drips the 4-step remarketing series to the internal lead
// list (un-converted leads who never subscribed). Progress is tracked via the shared email_sends log, so a
// lead advances one step per eligible run and never gets a step twice (sendCampaign de-dupes + logs).
//
// Schedule in seo/vercel.json. Secured by CRON_SECRET. No-ops if the email provider or DB is unconfigured.
// BATCH × runs/day is kept under the ESP's daily cap (Resend free = 100/day, shared with abandoned/welcome) —
// tune BATCH + the cron cadence together, or raise once on a paid plan.
import { getReengagementCandidates } from '../../../../lib/leads-db.mjs';
import { sendCampaign, hasEmail } from '../../../../lib/email/send.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Don't email a just-captured lead — hold off FLOOR_H hours after capture. Default 12h (launch-safe). For a
// fast end-to-end test of the cron flow, set LEAD_RM_FLOOR_HOURS=0 on Vercel (env override, no code change).
const FLOOR_H = Number(process.env.LEAD_RM_FLOOR_HOURS ?? 12);           // don't email a just-captured lead
const GAP_DAYS = (process.env.LEAD_RM_GAP_DAYS || '2,3,4').split(',').map((n) => Number(n) || 3); // gaps for steps 2/3/4
const BATCH = Number(process.env.LEAD_RM_BATCH || 20);                    // sends per run (× runs/day ≤ ESP cap)
const DELAY_MS = Number(process.env.LEAD_RM_DELAY_MS || 600);            // pacing between sends
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  return !secret || req.headers.get('authorization') === `Bearer ${secret}`;
}

// Which step (1-4) is this lead due for right now, or 0 if none.
function dueStep(c, now) {
  if (c.stepsSent >= 4) return 0;
  if (c.stepsSent === 0) {
    const cap = c.capturedAt ? new Date(c.capturedAt).getTime() : 0;
    return now - cap >= FLOOR_H * 3600e3 ? 1 : 0;
  }
  const last = c.lastSentAt ? new Date(c.lastSentAt).getTime() : 0;
  const gap = (GAP_DAYS[c.stepsSent - 1] ?? 3) * 86400e3; // stepsSent=1 → gap before step 2, etc.
  return now - last >= gap ? c.stepsSent + 1 : 0;
}

export async function GET(req) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 });
  if (!hasEmail) return Response.json({ ok: true, skipped: 'email provider not configured' });
  // Safety gate: the drip stays OFF until explicitly launched, so a test session (or an early deploy) never
  // blasts the real 325-lead list before deliverability is verified. Set LEAD_RM_ENABLED=1 on Vercel to launch.
  if (process.env.LEAD_RM_ENABLED !== '1') {
    return Response.json({ ok: true, skipped: 'lead drip disabled — set LEAD_RM_ENABLED=1 to launch' });
  }

  const now = Date.now();
  const candidates = await getReengagementCandidates(2000);
  const due = candidates.map((c) => ({ c, step: dueStep(c, now) })).filter((x) => x.step > 0).slice(0, BATCH);

  let sent = 0, suppressed = 0, errors = 0;
  for (let i = 0; i < due.length; i++) {
    const { c, step } = due[i];
    try {
      const r = await sendCampaign({ to: c.email, campaign: `lead_remarketing_${step}`, vars: { query: c.query, searchType: c.searchType }, meta: { step } });
      if (r.status === 'sent') sent += 1;
      else if (r.status === 'suppressed') suppressed += 1;
      else errors += 1;
    } catch { errors += 1; }
    if (i < due.length - 1) await sleep(DELAY_MS);
  }
  return Response.json({ ok: true, candidates: candidates.length, due: due.length, sent, suppressed, errors });
}
