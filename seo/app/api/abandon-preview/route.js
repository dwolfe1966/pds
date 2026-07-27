// GET /api/abandon-preview?secret=<CRON_SECRET>&to=<test-inbox>&send=1&count=30&sample=5
//
// Owner test tool (2026-07-27): pull the next N abandoned-checkout candidates, and — when send=1 — deliver a
// RANDOM sample of `sample` of them to a single TEST inbox, rendered through the EXACT production path (real
// enrichment + real minted password-less login links). Lets the owner preview the real email + click the real
// CTA before any blast. Marks NOTHING (does not stamp emailed_at), so the real cron send is unaffected.
//
// Sampling is biased to INCLUDE account-holders when the batch has any, so the auto-login CTA is actually
// testable (most abandoners never created an account → prefill CTA). Secret-gated. Never returns creds.
import { hasLeadsDb, getPendingFirstEmail } from '../../../lib/leads-db.mjs';
import { hasSendgrid, renderCheckoutAbandoned, sendEmail } from '../../../lib/email/send.mjs';
import { enrichAbandonTarget } from '../../../lib/abandonEnrich.mjs';
import { mintAutoLoginUrl, hasBcAutoLogin, hasBcAccount } from '../../../lib/bcAutoLogin.mjs';
import { logSend } from '../../../lib/email/emails-db.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DELAY_MIN = Number(process.env.EMAIL_FIRST_DELAY_MIN || 2);

function authorized(req, url) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('authorization') === `Bearer ${secret}` || url.searchParams.get('secret') === secret;
}

const targetName = (row) => {
  const t = row && row.meta && typeof row.meta === 'object' ? row.meta.target : null;
  return t && t.name ? String(t.name).trim() : '';
};

// Fisher–Yates using Math.random (a normal Node route — not a Workflow sandbox, so Math.random is allowed).
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET(req) {
  const url = new URL(req.url);
  if (!authorized(req, url)) return new Response('unauthorized', { status: 401 });
  if (!hasLeadsDb) return Response.json({ ok: false, error: 'no leads db' }, { status: 400 });

  const count = Math.min(Number(url.searchParams.get('count') || 30), 100);
  const sample = Math.min(Number(url.searchParams.get('sample') || 5), count);
  const send = url.searchParams.get('send') === '1';
  const to = (url.searchParams.get('to') || '').trim();

  // Pull candidates (deduped by email). Data-rich only by default: drop rows with no searched person (they'd
  // render the weak generic "finish setting up" email). Override with &includeNoTarget=1. Pull extra then trim,
  // so target-only filtering still yields ~count.
  const includeNoTarget = url.searchParams.get('includeNoTarget') === '1';
  const hasTarget = (r) => !!(r && r.meta && typeof r.meta === 'object' && r.meta.target && r.meta.target.name);
  const raw = await getPendingFirstEmail(DELAY_MIN, count * 3);
  const rows = (includeNoTarget ? raw : raw.filter(hasTarget)).slice(0, count);

  // Annotate each with whether it has a BC account (→ auto-login CTA) or not (→ prefill CTA).
  const canAuto = hasBcAutoLogin();
  const annotated = [];
  for (const r of rows) {
    const account = canAuto ? await hasBcAccount(r.email).catch(() => false) : false;
    annotated.push({ id: r.id, email: r.email, target: targetName(r) || null, hasAccount: account });
  }
  const accountCount = annotated.filter((a) => a.hasAccount).length;
  const candidates = annotated.map((a) => ({ email: a.email, target: a.target, cta: a.hasAccount ? 'auto-login' : 'prefill' }));

  if (!send) {
    return Response.json({ ok: true, mode: 'list', count: annotated.length, accountCount, candidates });
  }

  // ── send mode ──
  if (!to) return Response.json({ ok: false, error: '&to=<inbox> required when send=1' }, { status: 400 });
  if (!hasSendgrid) return Response.json({ ok: false, error: 'no email provider configured' }, { status: 400 });

  // Optional: force-include specific addresses (e.g. the owner's OWN account) so a login-link email is
  // GUARANTEED in the test even if this batch has no account-holders. Synthesized as no-target rows → the
  // account-activation variant, which still carries the auto-login CTA. Safe to click (their own account).
  const includeEmails = (url.searchParams.get('include') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const includeAnnotated = [];
  for (const em of includeEmails) {
    const account = canAuto ? await hasBcAccount(em).catch(() => false) : false;
    includeAnnotated.push({ id: `include:${em}`, email: em, target: null, hasAccount: account, _synthetic: true });
  }

  // Bias the sample to include account-holders (so the login-link CTA is testable) then fill the rest randomly.
  const withAcct = shuffle(annotated.filter((a) => a.hasAccount));
  const without = shuffle(annotated.filter((a) => !a.hasAccount));
  const wantAcct = Math.min(withAcct.length, Math.min(2, sample));
  const fromBatch = shuffle([...withAcct.slice(0, wantAcct), ...without, ...withAcct.slice(wantAcct)])
    .slice(0, Math.max(0, sample - includeAnnotated.length));
  const picked = [...includeAnnotated, ...fromBatch];

  const sent = [];
  for (const a of picked) {
    const row = a._synthetic
      ? { id: a.id, email: a.email, person_id: null, meta: {} }
      : rows.find((r) => r.id === a.id);
    try {
      const target = row.meta && typeof row.meta === 'object' ? row.meta.target : null;
      const enrichment = target ? await enrichAbandonTarget(target).catch(() => null) : null;
      let ctaUrl = null;
      if (a.hasAccount) {
        const next = process.env.ABANDON_AUTOLOGIN_NEXT || '/payment';
        const minted = await mintAutoLoginUrl(row.email, `/auth/session?next=${next}`).catch(() => null);
        if (minted && minted.url) ctaUrl = minted.url;
      }
      const { subject, html, text } = renderCheckoutAbandoned(row, 'first', enrichment, ctaUrl);
      // Deliver to the TEST inbox (not the real recipient); keep the body pristine so it's a true preview.
      await sendEmail({ to, subject, html, text });
      await logSend({ email: to, campaign: 'abandon_preview', subject, status: 'sent', meta: { forEmail: row.email, cta: ctaUrl ? 'auto-login' : 'prefill' } }).catch(() => {});
      sent.push({ forEmail: row.email, target: a.target, cta: ctaUrl ? 'auto-login' : 'prefill', subject });
    } catch (err) {
      sent.push({ forEmail: row.email, error: String((err && err.message) || err) });
    }
  }

  return Response.json({ ok: true, mode: 'send', to, deliveredTo: to, batchSize: annotated.length, accountCount, sent, note: 'Nothing marked — real cron send is unaffected. Each email is exactly what the real recipient would get.' });
}
