// POST /api/incarceration — first-party incarceration/booking lookup on the idlookup.me Vercel server
// (keys stay server-side). Powers the inmate (/name/landing/v3) experience: mugshots, charges, facility,
// booking dates. Provider-abstracted (JailBase + UnlimitedCriminalChecks) — see lib/incarceration.mjs.
import { after } from 'next/server';
import { findBookings } from '../../../lib/incarceration.mjs';
import { BROWSER_TIER, hydrateStateInmates } from '../../../lib/stateInmates.mjs';

export const runtime = 'nodejs';
// Browser-tier + captcha hydration (after()) runs a ~30–60s Browserless + 2Captcha flow post-response —
// give the invocation room so Vercel doesn't kill it before the DB upsert. (Capped by the plan's max.)
export const maxDuration = 300;

const ALLOWED_ORIGINS = new Set([
  'https://www.idlookup.ai',
  'https://idlookup.ai',
  'https://dev.www.idlookup.ai', // BC dev host — so the inmate teaser works when QA-testing the dev bundle
  'https://idlookup.me',         // SEO/prototype host
  'https://www.idlookup.me',
  'http://localhost:3000',
]);

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai';
  return {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
    'Vary': 'Origin',
  };
}

export async function OPTIONS(req) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
}

export async function POST(req) {
  const headers = { ...corsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' };
  let body;
  try { body = await req.json(); } catch { body = null; }
  if (!body || (!body.lastName && !body.firstName)) {
    return new Response(JSON.stringify({ error: 'name required' }), { status: 400, headers });
  }
  try {
    const q = {
      firstName: body.firstName ? String(body.firstName).trim() : undefined,
      lastName: body.lastName ? String(body.lastName).trim() : undefined,
      state: body.state ? String(body.state).trim().toUpperCase() : undefined,
      city: body.city ? String(body.city).trim() : undefined,
      age: body.age,
      sourceId: body.sourceId,
    };
    const out = await findBookings(q, process.env);
    // ON-DEMAND HYDRATION (owner 2026-07-18): a browser-tier search (TX/NY) serves cached DB rows NOW;
    // after the response, refresh that name from the live browser into the DB so the next searcher gets
    // fresh data. after() runs post-response on Vercel, so the searcher is never blocked by the ~20s browser.
    if (q.state && q.lastName && BROWSER_TIER.has(q.state)) {
      after(() => hydrateStateInmates(q, process.env));
    }
    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'lookup failed', count: 0, records: [] }), { status: 200, headers });
  }
}
