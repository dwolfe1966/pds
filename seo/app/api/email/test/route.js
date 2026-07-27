// GET /api/email/test?to=<email>&campaign=<welcome|remarketing1..4>&secret=<CRON_SECRET>
// Sends ONE real email via the configured provider so we can verify the pipeline end-to-end (provider auth,
// domain auth/deliverability, template render, from-address, unsubscribe). Renders our real templates to the
// ONE specified recipient — does NOT touch the lead list or suppression. Guarded by CRON_SECRET (Bearer or
// ?secret=). Remove or leave (harmless) after verifying.
import { sendEmail, renderWelcome, renderRemarketing, hasEmail, emailProvider } from '../../../lib/email/send.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req, url) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured → allow (dev)
  return req.headers.get('authorization') === `Bearer ${secret}` || url.searchParams.get('secret') === secret;
}

export async function GET(req) {
  const url = new URL(req.url);
  if (!authorized(req, url)) return new Response('unauthorized', { status: 401 });

  const to = url.searchParams.get('to');
  if (!to) return Response.json({ ok: false, error: '?to=<email> required' }, { status: 400 });
  if (!hasEmail) return Response.json({ ok: false, error: `email provider not configured (provider=${emailProvider})` }, { status: 400 });

  const which = url.searchParams.get('campaign') || 'remarketing1';
  let payload;
  if (which.startsWith('remarketing')) {
    const step = Number(which.replace(/\D/g, '')) || 1;
    // Sample query so the resume-CTA prefill is visible in the test.
    payload = renderRemarketing({ step, email: to, query: { firstName: 'John', lastName: 'Smith', state: 'TX', city: 'Austin' } });
  } else {
    payload = renderWelcome({ email: to, firstName: 'there' });
  }
  payload = { ...payload, subject: `[TEST] ${payload.subject}` };

  try {
    const res = await sendEmail({ to, subject: payload.subject, html: payload.html, text: payload.text });
    const providerId = res && res[0] && res[0].headers && res[0].headers['x-message-id'];
    return Response.json({ ok: true, provider: emailProvider, from: process.env.EMAIL_FROM || null, to, campaign: which, providerId: providerId || null });
  } catch (e) {
    return Response.json({ ok: false, provider: emailProvider, error: String((e && e.message) || e) }, { status: 500 });
  }
}
