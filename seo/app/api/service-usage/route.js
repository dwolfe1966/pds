// GET /api/service-usage — one place to watch metered-service spend: today + trailing 30 days + est. cost +
// the active daily cap, across every paid service that has a guard (Enformion, PDL, Browser.io, 2Captcha,
// Twilio). Read-only. Secured by CRON_SECRET (same bearer as the crons) so it isn't publicly scrapable; add
// `?secret=` for a quick browser check.
import { serviceUsageSummary } from '../../../lib/serviceBudget.mjs';
import { pdlUsageSummary } from '../../../lib/pdlBudget.mjs';
import { enformionUsageSummary } from '../../../lib/enformionBudget.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev
  const url = new URL(req.url);
  return req.headers.get('authorization') === `Bearer ${secret}` || url.searchParams.get('secret') === secret;
}

export async function GET(req) {
  if (!authorized(req)) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  const [services, pdl, enformion] = await Promise.all([
    serviceUsageSummary().catch(() => null),
    pdlUsageSummary().catch(() => null),
    enformionUsageSummary().catch(() => null),
  ]);
  return Response.json({
    ok: true,
    asOf: new Date().toISOString(),
    services: {
      ...(enformion ? { enformion } : {}),
      ...(pdl ? { pdl } : {}),
      ...(services || {}), // browser, captcha, twilio
    },
  });
}
