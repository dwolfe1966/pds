// POST /api/phone-intel — reverse-phone line-safety signal (Twilio Lookup v2) on the idlookup.me Vercel
// server (keys stay server-side). Returns { available, lineType, carrier, riskLevel } — DESCRIPTIVE only.
// See lib/phoneIntel.mjs for the compliance notes + cost gating.
import { getPhoneIntel } from '../../../lib/phoneIntel.mjs';

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
  const phone = body && body.phone;
  if (!phone) {
    return new Response(JSON.stringify({ error: 'phone required' }), { status: 400, headers });
  }
  try {
    const result = await getPhoneIntel({ phone });
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ available: false }), { status: 200, headers });
  }
}
