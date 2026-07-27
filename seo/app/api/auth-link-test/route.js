// GET /api/auth-link-test?e=<email>&redirect=<path>&secret=<CRON_SECRET>
// Prototype: mint a BC auto-login link for a consumer via getAutoLoginUrl (headless CSR service login).
// Returns { url, userId } so we can CLICK the link (verify auto-login + redirect) and re-click later to
// MEASURE its TTL, before wiring it into the abandon cron. Secret-gated. Read-only-ish (mints a short-lived
// login link; no data mutation). See lib/bcAutoLogin.mjs (SECURITY note: needs CSR admin creds).
import { mintAutoLoginUrl, hasBcAutoLogin } from '../../../lib/bcAutoLogin.mjs';

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
  const redirect = url.searchParams.get('redirect') || '/dashboard';
  if (!email) return Response.json({ ok: false, error: '?e=<email> required' }, { status: 400 });
  if (!hasBcAutoLogin()) return Response.json({ ok: false, error: 'BC CSR creds not set (BC_CSR_API_URL / BC_CSR_USERNAME / BC_CSR_PASSWORD)' }, { status: 400 });

  const r = await mintAutoLoginUrl(email, redirect);
  // Include the mint timestamp so we can compute the TTL when we re-test the link.
  return Response.json({ ok: !!r.url, mintedAt: new Date().toISOString(), redirect, ...r }, { status: r.url ? 200 : 502 });
}
