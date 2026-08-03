// GET /api/cron/wsfy-alerts — WSFY "who's searching for you" alert / re-engagement email.
//
// v1 (this file): the GENERAL-OFFER top-of-funnel hook — a one-shot "who's searching for you?" email to the
// un-converted lead list, driving to the /my-exposure self-check. Tests WSFY as a top-of-funnel conversion
// hook on our OWN lead list (free channel), mirroring the paid display campaign. Honest: realCount=0 → a
// general invitation to find out, NEVER a claim that a specific person searched them (we don't know a lead's
// own identity). Real-signal member alerts ("N people searched for you") are a FOLLOW-UP mode.
//
// Reuses the email platform: sendCampaign renders the 'wsfy_alert' template, honors suppression, and logs to
// email_sends; getWsfyAlertCandidates de-dupes via that log so a lead gets the alert only once. Schedule in
// seo/vercel.json. Secured by CRON_SECRET. Safe-by-default: OFF until WSFY_ALERTS_ENABLED=1, and CAN-SPAM-gated
// on EMAIL_POSTAL_ADDRESS. No-ops if the email provider or DB is unconfigured.
import { getWsfyAlertCandidates, getWsfySelfLeads } from '../../../../lib/leads-db.mjs';
import { sendCampaign, hasEmail, hasPostalAddress } from '../../../../lib/email/send.mjs';
import { buildWsfySummary, hasWsfyDb } from '../../../../lib/wsfy.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = Number(process.env.WSFY_ALERTS_BATCH || 20);      // sends per run (× runs/day ≤ ESP daily cap)
const DELAY_MS = Number(process.env.WSFY_ALERTS_DELAY_MS || 600); // pacing between sends
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  return !secret || req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 });
  if (!hasEmail) return Response.json({ ok: true, skipped: 'email provider not configured' });

  const enabled = process.env.WSFY_ALERTS_ENABLED === '1';
  const testEmail = (process.env.WSFY_ALERTS_TEST_EMAIL || '').trim().toLowerCase();
  // Gate — OFF by default. WSFY_ALERTS_TEST_EMAIL sends ONE email to that inbox (test the real send flow, no
  // blast); WSFY_ALERTS_ENABLED=1 sends to the un-converted lead list. Both still require Resend to be configured.
  if (!enabled && !testEmail) {
    return Response.json({ ok: true, skipped: 'wsfy alerts gated — WSFY_ALERTS_ENABLED=1 to launch, or WSFY_ALERTS_TEST_EMAIL=you@example.com to test one inbox' });
  }
  // CAN-SPAM hard gate for a real blast; test-to-your-own-inbox is exempt (not a commercial mailing to strangers).
  if (enabled && !testEmail && !hasPostalAddress) {
    return Response.json({ ok: true, skipped: 'blocked: set EMAIL_POSTAL_ADDRESS (CAN-SPAM)' });
  }

  let sent = 0, suppressed = 0, errors = 0, realSignal = 0;
  const tally = (r) => { if (r.status === 'sent') sent += 1; else if (r.status === 'suppressed') suppressed += 1; else errors += 1; };

  // TEST MODE → one inbox. WSFY_ALERTS_TEST_REALCOUNT previews the "N searched for you" version (default 0).
  if (testEmail) {
    const realCount = Number(process.env.WSFY_ALERTS_TEST_REALCOUNT || 0);
    try { tally(await sendCampaign({ to: testEmail, campaign: 'wsfy_alert', vars: { realCount }, meta: { mode: 'test', realCount } })); } catch { errors += 1; }
    return Response.json({ ok: true, mode: `test:${testEmail}`, eligible: 1, sent, suppressed, errors });
  }

  let remaining = BATCH;
  const done = new Set();

  // PASS 1 — self-identified leads (we know their own name) → REAL signal. Reverse-join their count; if >0 send
  // "N people searched for you", else fall back to the general offer. This is the payoff of the capture loop.
  if (hasWsfyDb) {
    const selfLeads = (await getWsfySelfLeads(500)).slice(0, remaining);
    for (const lead of selfLeads) {
      if (remaining <= 0) break;
      let realCount = 0;
      try {
        // Pass the lead's OWN searcher ids so their self-check searches are excluded from their count.
        const sum = await buildWsfySummary({ name: lead.selfName, state: lead.selfState, selfUserId: lead.searcherUserId, selfSession: lead.searcherSession }, { tier: 'free' });
        realCount = Number(sum && sum.count) || 0;
      } catch { realCount = 0; }
      try {
        tally(await sendCampaign({ to: lead.email, campaign: 'wsfy_alert', vars: { realCount }, meta: { mode: realCount > 0 ? 'self_real' : 'self_general', realCount } }));
        if (realCount > 0) realSignal += 1;
      } catch { errors += 1; }
      done.add(lead.email); remaining -= 1;
      await sleep(DELAY_MS);
    }
  }

  // PASS 2 — the BROAD lead list → general offer. GATED behind WSFY_ALERTS_INCLUDE_ALL_LEADS=1 on purpose:
  // the `leads` table has NO payment marker (payment = BC state, not visible here), and every signup is
  // captured as a lead BEFORE paying — so this list INCLUDES paying members, whom we can't filter out here.
  // WSFY_ALERTS_ENABLED=1 alone runs ONLY Pass 1 (self-identified leads = an appropriate, targeted audience).
  // Opt into the broad blast explicitly, once you've decided you're OK reaching the whole lead list.
  const includeAllLeads = process.env.WSFY_ALERTS_INCLUDE_ALL_LEADS === '1';
  let broadSent = false;
  if (remaining > 0 && includeAllLeads) {
    broadSent = true;
    const general = (await getWsfyAlertCandidates(2000)).filter((l) => !done.has(l.email)).slice(0, remaining);
    for (const lead of general) {
      try { tally(await sendCampaign({ to: lead.email, campaign: 'wsfy_alert', vars: { realCount: 0 }, meta: { mode: 'lead_general' } })); } catch { errors += 1; }
      await sleep(DELAY_MS);
    }
  }

  return Response.json({ ok: true, mode: broadSent ? 'self+broad_leads' : 'self_only', sent, realSignal, suppressed, errors, note: includeAllLeads ? undefined : 'broad lead blast held — set WSFY_ALERTS_INCLUDE_ALL_LEADS=1 to include the full lead list (incl. paying members)' });
}
