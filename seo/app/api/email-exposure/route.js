// POST /api/email-exposure — HIBP breach-exposure lookup on the idlookup.me Vercel server (HIBP key stays
// server-side). Returns { available, breached, count, breaches, topDataClasses, mostRecent }. Cache-first.
// See lib/emailExposure.mjs (self-check use; graceful degradation) + lib/emailExposureDb.mjs (per-email cache).
import { getEmailExposure } from '../../../lib/emailExposure.mjs';

export const runtime = 'nodejs';
export const maxDuration = 15;

const ALLOWED_ORIGINS = new Set([
  'https://www.idlookup.ai',
  'https://idlookup.ai',
  'https://dev.www.idlookup.ai',
  'https://idlookup.me',
  'https://www.idlookup.me',
  'http://localhost:3000',
  'http://localhost:3010',
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
  const email = body && body.email;
  if (!email) {
    return new Response(JSON.stringify({ error: 'email required' }), { status: 400, headers });
  }
  try {
    const result = await getEmailExposure({ email });
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ available: false }), { status: 200, headers });
  }
}
