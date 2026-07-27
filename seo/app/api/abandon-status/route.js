// GET /api/abandon-status?secret=<CRON_SECRET>            → monitoring dashboard (today's sends, cap, recent outcomes, pending)
// GET /api/abandon-status?secret=...&pause=1              → INSTANT kill-switch (halts the cron, no redeploy)
// GET /api/abandon-status?secret=...&resume=1             → clear the kill-switch
//
// One place to watch the abandon-recovery send during warm-up and stop it fast if anything looks wrong.
// Read-only except the explicit pause/resume flag flip. Secret-gated.
import { hasLeadsDb, getPendingFirstEmail, getPendingFollowup } from '../../../lib/leads-db.mjs';
import { hasSendgrid, hasPostalAddress } from '../../../lib/email/send.mjs';
import { hasBcAutoLogin } from '../../../lib/bcAutoLogin.mjs';
import {
  countSentToday, abandonDailyCap, recentSends, getFlag, setFlag, listSuppression,
} from '../../../lib/email/emails-db.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req, url) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('authorization') === `Bearer ${secret}` || url.searchParams.get('secret') === secret;
}

const hasTarget = (r) => !!(r && r.meta && typeof r.meta === 'object' && r.meta.target && r.meta.target.name);

export async function GET(req) {
  const url = new URL(req.url);
  if (!authorized(req, url)) return new Response('unauthorized', { status: 401 });

  // Kill-switch toggle (explicit action).
  let action = null;
  if (url.searchParams.get('pause') === '1') { await setFlag('abandon_paused', '1'); action = 'paused'; }
  else if (url.searchParams.get('resume') === '1') { await setFlag('abandon_paused', '0'); action = 'resumed'; }

  if (!hasLeadsDb) return Response.json({ ok: false, error: 'no db' }, { status: 400 });

  const enabled = process.env.ABANDON_ENABLED === '1';
  const paused = (await getFlag('abandon_paused')) === '1';
  const cap = await abandonDailyCap();
  const sentToday = await countSentToday('abandoned_%');
  const firstMin = Number(process.env.EMAIL_FIRST_DELAY_MIN || 30);
  const followHrs = Number(process.env.EMAIL_FOLLOWUP_DELAY_HOURS || 24);

  // Pending eligibility (data-rich only, matching the cron's default filter) — how many are queued right now.
  const includeNoTarget = process.env.ABANDON_INCLUDE_NO_TARGET === '1';
  const firstPending = (await getPendingFirstEmail(firstMin)).filter((r) => includeNoTarget || hasTarget(r));
  const followPending = (await getPendingFollowup(followHrs)).filter((r) => includeNoTarget || hasTarget(r));

  const recent = await recentSends('abandoned_%', 25);
  const errors24 = recent.filter((r) => r.status === 'error').length;

  return Response.json({
    ok: true,
    action,
    live: enabled && !paused,
    state: {
      enabled,                 // ABANDON_ENABLED
      paused,                  // kill-switch
      sending: enabled && !paused,
    },
    today: {
      sent: sentToday,
      cap,
      remaining: Math.max(0, cap - sentToday),
    },
    queue: {
      firstPending: firstPending.length,
      followupPending: followPending.length,
    },
    config: {
      firstDelayMin: firstMin,
      followupDelayHours: followHrs,
      ramp: process.env.ABANDON_RAMP === '1',
      dailyCapOverride: process.env.ABANDON_DAILY_CAP || null,
      maxAgeDays: Number(process.env.ABANDON_MAX_AGE_DAYS || 0) || null,
      includeNoTarget,
      autoLoginConfigured: hasBcAutoLogin(),
      emailProviderConfigured: hasSendgrid,
      postalAddressSet: hasPostalAddress, // CAN-SPAM — cron refuses to send if false
      perRun: Number(process.env.ABANDON_PER_RUN || 8),
    },
    blockers: [
      !hasSendgrid && 'no email provider (RESEND_API_KEY)',
      !hasPostalAddress && 'EMAIL_POSTAL_ADDRESS unset (CAN-SPAM)',
      !enabled && 'ABANDON_ENABLED != 1',
      paused && 'paused (kill-switch)',
    ].filter(Boolean),
    suppression: (await listSuppression(100000)).length,
    recentErrors: errors24,
    recent,
    hint: 'pause: ?pause=1 · resume: ?resume=1',
  });
}
