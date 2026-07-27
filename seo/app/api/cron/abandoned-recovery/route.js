// GET /api/cron/abandoned-recovery — Vercel Cron drives abandoned-checkout recovery.
//
// Timing (owner 2026-07-13): 1st email 30 min after abandonment; 1 follow-up 24h later.
// Schedule in seo/vercel.json (e.g. every 15 min). Secured by CRON_SECRET: when that env
// var is set, Vercel auto-sends `Authorization: Bearer <CRON_SECRET>` on cron invocations.
//
// Safe before SendGrid is wired: if SENDGRID_API_KEY is unset it no-ops (skipped), and if
// the DB is unconfigured it no-ops too — so deploying this route early does nothing harmful.
import {
  hasLeadsDb,
  getPendingFirstEmail,
  getPendingFollowup,
  markRecoveryEmailed,
} from '../../../../lib/leads-db.mjs';
import { hasSendgrid, renderCheckoutAbandoned, sendEmail, hasPostalAddress } from '../../../../lib/email/send.mjs';
import { enrichAbandonTarget } from '../../../../lib/abandonEnrich.mjs';
import { logSend, countSentToday, abandonDailyCap, suppressedSet, getFlag } from '../../../../lib/email/emails-db.mjs';
import { mintAutoLoginUrl, hasBcAutoLogin } from '../../../../lib/bcAutoLogin.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Each row does enrich (Enformion) + mint (BC) + send (Resend) sequentially — a few seconds each. Cap the
// per-run batch (below) so this comfortably fits; raise the ceiling too in case a run is slow.
export const maxDuration = 60;

// Real timers (owner 2026-07-13): 1st email 30 min after abandonment, 1 follow-up 24h later. Env-overridable
// (set EMAIL_FIRST_DELAY_MIN / EMAIL_FOLLOWUP_DELAY_HOURS smaller to fast-test the cron flow).
const FIRST_DELAY_MIN = Number(process.env.EMAIL_FIRST_DELAY_MIN || 30);
const FOLLOWUP_DELAY_HOURS = Number(process.env.EMAIL_FOLLOWUP_DELAY_HOURS || 24);

async function processStage(rows, stage) {
  let sent = 0, failed = 0;
  for (const row of rows) {
    try {
      // Enrich the target with real teaser data (locations + booking + life-events) so the email leans hard
      // into data. Self-gating + never throws → falls back to the plain card.
      const target = row && row.meta && typeof row.meta === 'object' ? row.meta.target : null;
      const enrichment = target ? await enrichAbandonTarget(target).catch(() => null) : null;
      // Mint a password-less auto-login link when this abandoner HAS a BC account (they reached the payment
      // step). Minted at SEND time so it's freshest for the open. redirect routes through /auth/session so
      // the SPA adopts the BC cookie before landing (project_autologin_abandon). No account → null → the
      // email falls back to the prefilled resume link. Never blocks the send.
      let ctaUrl = null;
      if (hasBcAutoLogin()) {
        // Land account holders on /payment, NOT /dashboard: a State-B abandoner (reached payment, declined/
        // bailed) is UNPAID, so /dashboard is a paywalled dead-end. /payment stands alone (default signup
        // offer, no target needed) and redirects paid users away — so it's a working resume-checkout, one
        // step from done. Auth adopts on /auth/session first, so PaymentPage sees the token and won't bounce.
        const next = process.env.ABANDON_AUTOLOGIN_NEXT || '/payment';
        const minted = await mintAutoLoginUrl(row.email, `/auth/session?next=${next}`).catch(() => null);
        if (minted && minted.url) ctaUrl = minted.url;
      }
      const { subject, html, text } = renderCheckoutAbandoned(row, stage, enrichment, ctaUrl);
      await sendEmail({ to: row.email, subject, html, text });
      await markRecoveryEmailed(row.id, stage);
      await logSend({ email: row.email, campaign: `abandoned_${stage}`, subject, status: 'sent', meta: { autoLogin: !!ctaUrl } }).catch(() => {});
      sent++;
    } catch (err) {
      // Log the failure so it's visible in email_sends (the row stays un-stamped → next run retries it).
      await logSend({ email: row.email, campaign: `abandoned_${stage}`, status: 'error', meta: { error: String((err && err.message) || err) } }).catch(() => {});
      failed++;
    }
  }
  return { sent, failed, eligible: rows.length };
}

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
  }

  const body = { ok: true };
  if (!hasLeadsDb) return json({ ...body, skipped: 'no db' });
  if (!hasSendgrid) return json({ ...body, skipped: 'no email provider' });

  // Safety gate (owner 2026-07-27: hold the ~600 backlog until we decide how to work it).
  //   - ABANDON_ENABLED=1        → send to ALL eligible rows (full launch).
  //   - ABANDON_TEST_EMAIL=x     → send ONLY to that address (test the real cron flow, no blast).
  //   - neither                  → skip (default OFF — nothing sends).
  const enabled = process.env.ABANDON_ENABLED === '1';
  const testEmail = (process.env.ABANDON_TEST_EMAIL || '').trim().toLowerCase();
  if (!enabled && !testEmail) {
    return json({ ...body, skipped: 'abandon recovery gated — set ABANDON_ENABLED=1 to launch, or ABANDON_TEST_EMAIL=you@example.com to test one inbox' });
  }
  // Instant kill-switch: a DB flag (set via /api/abandon-status?pause=1) halts sending with NO redeploy.
  if (enabled && (await getFlag('abandon_paused')) === '1') {
    return json({ ...body, mode: 'all', skipped: 'paused (kill-switch active — /api/abandon-status?resume=1 to resume)' });
  }
  // CAN-SPAM hard gate: never blast without a physical postal address in the footer. Test-to-one-inbox is
  // exempt (it's not a commercial mailing to strangers).
  if (enabled && !hasPostalAddress) {
    return json({ ...body, mode: 'all', skipped: 'blocked: set EMAIL_POSTAL_ADDRESS (CAN-SPAM requires a physical postal address in every commercial email)' });
  }
  // Data-rich only: recover ONLY abandoners who actually searched a person (we have a teaser hook). Rows with
  // no target render the weak generic "finish setting up" email — off-strategy, and those abandoners belong to
  // a cold-lead drip, not cart recovery. Override with ABANDON_INCLUDE_NO_TARGET=1.
  const includeNoTarget = process.env.ABANDON_INCLUDE_NO_TARGET === '1';
  const hasTarget = (r) => !!(r && r.meta && typeof r.meta === 'object' && r.meta.target && r.meta.target.name);
  // Recency window: don't reach out to very old abandoners (stale intent + risky for a warming domain).
  // ABANDON_MAX_AGE_DAYS=0 (default) → no age limit (work the whole backlog).
  const maxAgeMs = Number(process.env.ABANDON_MAX_AGE_DAYS || 0) * 86400000;
  const fresh = (r) => !maxAgeMs || (r.abandoned_at && (Date.now() - new Date(r.abandoned_at).getTime()) <= maxAgeMs);
  const scope = (rows) => {
    const filtered = (includeNoTarget ? rows : rows.filter(hasTarget)).filter(fresh);
    return enabled ? filtered : filtered.filter((r) => String(r.email || '').toLowerCase() === testEmail);
  };

  try {
    // Daily send cap (warm-up ramp), enforced across every cron run in the day. Test mode (single inbox) is
    // exempt from the cap so it always fires.
    const cap = await abandonDailyCap();
    const already = enabled ? await countSentToday('abandoned_%') : 0;
    let remaining = enabled ? Math.max(0, cap - already) : Number.MAX_SAFE_INTEGER;
    if (enabled && remaining <= 0) {
      return json({ ...body, mode: 'all', cap, sentToday: already, skipped: `daily cap reached (${already}/${cap})` });
    }
    // Per-run batch cap: keep each invocation well under maxDuration AND spread the daily cap across the
    // */15 runs (gentler on a warming domain than one burst). e.g. 8/run × several runs → 25/day.
    if (enabled) remaining = Math.min(remaining, Number(process.env.ABANDON_PER_RUN || 8));

    // Pull candidates, drop suppressed (CAN-SPAM) in ONE batched query, then cap to the remaining budget.
    // First-emails take priority over follow-ups for the day's budget.
    const firstAll = scope(await getPendingFirstEmail(FIRST_DELAY_MIN));
    const followAll = scope(await getPendingFollowup(FOLLOWUP_DELAY_HOURS));
    const suppressed = await suppressedSet([...firstAll, ...followAll].map((r) => r.email));
    const notSup = (rows) => rows.filter((r) => !suppressed.has(String(r.email || '').trim().toLowerCase()));

    const firstRows = notSup(firstAll).slice(0, remaining);
    const first = await processStage(firstRows, 'first');
    remaining -= first.sent;
    const followRows = remaining > 0 ? notSup(followAll).slice(0, remaining) : [];
    const followup = await processStage(followRows, 'followup');

    return json({
      ...body,
      mode: enabled ? 'all' : `test:${testEmail}`,
      cap: enabled ? cap : null,
      sentToday: enabled ? already + first.sent + followup.sent : undefined,
      suppressedSkipped: suppressed.size || undefined,
      first, followup,
    });
  } catch (e) {
    return json({ ok: false, error: 'run failed' }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
