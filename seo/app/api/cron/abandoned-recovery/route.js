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
import { hasSendgrid, renderCheckoutAbandoned, sendEmail } from '../../../../lib/email/send.mjs';
import { enrichAbandonTarget } from '../../../../lib/abandonEnrich.mjs';
import { logSend } from '../../../../lib/email/emails-db.mjs';
import { mintAutoLoginUrl, hasBcAutoLogin } from '../../../../lib/bcAutoLogin.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ⚠️ TEST TIMERS (2026-07-27) — short delays so email flows can be tested by just using the site. RATCHET
// BACK UP before real launch: set env EMAIL_FIRST_DELAY_MIN=30 / EMAIL_FOLLOWUP_DELAY_HOURS=24 on Vercel, or
// revert these defaults to 30 / 24.
const FIRST_DELAY_MIN = Number(process.env.EMAIL_FIRST_DELAY_MIN || 2);
const FOLLOWUP_DELAY_HOURS = Number(process.env.EMAIL_FOLLOWUP_DELAY_HOURS || 1);

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
        const next = process.env.ABANDON_AUTOLOGIN_NEXT || '/dashboard';
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
  const scope = (rows) => (enabled ? rows : rows.filter((r) => String(r.email || '').toLowerCase() === testEmail));

  try {
    const first = await processStage(scope(await getPendingFirstEmail(FIRST_DELAY_MIN)), 'first');
    const followup = await processStage(scope(await getPendingFollowup(FOLLOWUP_DELAY_HOURS)), 'followup');
    return json({ ...body, mode: enabled ? 'all' : `test:${testEmail}`, first, followup });
  } catch (e) {
    return json({ ok: false, error: 'run failed' }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
