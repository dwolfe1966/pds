// POST /api/email/resend-webhook — Resend delivery events → suppression list.
//
// Closes the deliverability feedback loop: Resend returns 200 on ACCEPT, then bounces/complaints arrive
// asynchronously as webhook events. Without this, a warming domain burns reputation invisibly (our own send
// log only sees "sent"). Hard bounces + spam complaints get added to email_suppression so we never re-send.
//
// Configure in Resend: add a webhook → this URL, subscribe to email.bounced + email.complained. Set
// RESEND_WEBHOOK_SECRET (the `whsec_…` signing secret) so we verify the Svix signature. Fail-safe: it only
// ADDS suppressions, so the worst case is over-suppressing (we send LESS), never a non-compliant send.
import crypto from 'node:crypto';
import { addSuppression } from '../../../../lib/email/emails-db.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Svix signature verification (Resend uses Svix). Header `svix-signature` = space-separated `v1,<b64sig>`.
function verifySvix(secret, headers, body) {
  const id = headers.get('svix-id');
  const ts = headers.get('svix-timestamp');
  const sigHeader = headers.get('svix-signature');
  if (!id || !ts || !sigHeader) return false;
  try {
    const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
    const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
    return sigHeader.split(' ').some((part) => {
      const sig = part.split(',')[1];
      if (!sig || sig.length !== expected.length) return false;
      try { return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)); } catch { return false; }
    });
  } catch { return false; }
}

export async function POST(req) {
  const raw = await req.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const url = new URL(req.url);
  const manualOk = process.env.CRON_SECRET && url.searchParams.get('secret') === process.env.CRON_SECRET;

  if (secret && !manualOk && !verifySvix(secret, req.headers, raw)) {
    return new Response('bad signature', { status: 401 });
  }
  if (!secret && !manualOk) {
    // Refuse unauthenticated writes when no secret is configured (don't let anyone poison the list).
    return new Response('webhook secret not configured', { status: 401 });
  }

  let evt;
  try { evt = JSON.parse(raw); } catch { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }

  const type = String(evt && evt.type || '');
  const data = (evt && evt.data) || {};
  const tos = Array.isArray(data.to) ? data.to : (data.to ? [data.to] : []);

  let suppressed = 0;
  if (type === 'email.bounced' || type === 'email.complained') {
    const reason = type === 'email.complained' ? 'complaint' : 'bounce';
    for (const to of tos) {
      if (to) { await addSuppression(to, reason, 'resend-webhook'); suppressed++; }
    }
  }
  // 200 for every recognized event (incl. delivered/opened we ignore) so Resend doesn't retry.
  return Response.json({ ok: true, type, suppressed });
}
