// GET /api/auth-link-test?e=<email>&redirect=<path>&secret=<CRON_SECRET>
// Prototype: mint a BC auto-login link for a consumer via getAutoLoginUrl (headless CSR service login).
// Returns { url, userId } so we can CLICK the link (verify auto-login + redirect) and re-click later to
// MEASURE its TTL, before wiring it into the abandon cron. Secret-gated. Read-only-ish (mints a short-lived
// login link; no data mutation). See lib/bcAutoLogin.mjs (SECURITY note: needs CSR admin creds).
import { mintAutoLoginUrl, hasBcAutoLogin, probeUsers } from '../../../lib/bcAutoLogin.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req, url) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get('authorization') === `Bearer ${secret}` || url.searchParams.get('secret') === secret;
}

export async function GET(req) {
  const url = new URL(req.url);
  if (!authorized(req, url)) return new Response('unauthorized', { status: 401 });
  const email = url.searchParams.get('e');
  // The SPA can't consume a bare protected path (it bounces to /login before adopting BC's cookie session).
  // BC's loginLink must land on the PUBLIC /auth/session route, which calls adoptSession() then forwards to
  // ?next=<clean path>. Default to that; allow ?next=/my-identity etc. (?redirect= still overrides for probing.)
  const nextPath = url.searchParams.get('next') || '/dashboard';
  const redirect = url.searchParams.get('redirect')
    || `/auth/session?next=${nextPath}`;
  if (!email) return Response.json({ ok: false, error: '?e=<email> required' }, { status: 400 });
  if (!hasBcAutoLogin()) {
    // Report WHICH var the running function is missing (presence only — never the values).
    return Response.json({
      ok: false,
      error: 'BC CSR creds not visible to the deployed function',
      present: {
        BC_CSR_API_URL: !!process.env.BC_CSR_API_URL,
        BC_CSR_USERNAME: !!process.env.BC_CSR_USERNAME,
        BC_CSR_PASSWORD: !!process.env.BC_CSR_PASSWORD,
      },
      hint: 'All three must be true. If any is false: set it (Production scope) and REDEPLOY — env changes only apply to new deployments.',
    }, { status: 400 });
  }

  // ?probe=1 → diagnose the user lookup (does the session see users? does the email filter hit?) instead of minting.
  if (url.searchParams.get('probe') === '1') {
    return Response.json({ ok: true, probe: await probeUsers(email) });
  }

  const r = await mintAutoLoginUrl(email, redirect);
  // Include the mint timestamp so we can compute the TTL when we re-test the link.
  return Response.json({ ok: !!r.url, mintedAt: new Date().toISOString(), redirect, ...r }, { status: r.url ? 200 : 502 });
}
