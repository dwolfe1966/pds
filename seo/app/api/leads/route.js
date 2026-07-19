// POST /api/leads — first-party email-lead capture endpoint (Vercel + Neon).
//
// The consumer app (idlookup.ai) posts here from src/services/emailCapture.js. This
// runs on the SEO app's Vercel deployment (idlookup.me) reusing its Neon, but writes
// to a SEPARATE `leads` table (and can use a separate LEADS_DATABASE_URL for full PII
// isolation). Cross-origin from idlookup.ai → CORS is handled below.
//
// Setup: (1) run seo/db/leads-schema.sql once on the target Neon DB; (2) deploy the
// SEO app; (3) set the consumer prod REACT_APP_LEAD_CAPTURE_URL to
// https://idlookup.me/api/leads.
import { insertLead, hasLeadsDb } from '../../../lib/leads-db.mjs';

export const runtime = 'nodejs';

const ALLOWED_ORIGINS = new Set([
  'https://www.idlookup.ai',
  'https://idlookup.ai',
  'https://dev.www.idlookup.ai',
  'http://localhost:3000', // local prod-bundle testing
]);

function corsHeaders(origin) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.idlookup.ai';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
  const email = body && typeof body.email === 'string' ? body.email.trim() : '';
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'valid email required' }), { status: 400, headers });
  }

  // No DB configured yet — accept so the client's fire-and-forget POST doesn't error
  // (localStorage is still the durable client-side copy), but report it wasn't stored.
  if (!hasLeadsDb) {
    return new Response(JSON.stringify({ ok: true, persisted: false }), { status: 200, headers });
  }

  try {
    await insertLead({
      email,
      meta: body.meta,
      ts: body.ts,
      ip: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
      userAgent: req.headers.get('user-agent') || null,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'persist failed' }), { status: 500, headers });
  }
}
