// POST /api/social-presence — social-presence enrichment on the idlookup.me Vercel server (keys stay
// server-side). ENRICH a resolved person (email and/or name+city) → their public social profiles with a
// confidence tier. Layers PDL (rich seed) + Gravatar (opt-in corroboration/photo). See lib/socialPresence.mjs.
//
// ⚠️ EXPERIMENTAL. Legal watch-items are documented in lib/socialPresence.mjs (PDL production-display terms,
// CCPA opt-out, FCRA no-screening, no faceprints). Use for eval/internal now; gate public display on terms.
import { getSocialPresence } from '../../../lib/socialPresence.mjs';

export const runtime = 'nodejs';
export const maxDuration = 30;

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
  const { email, name, city, state, expectedName } = body || {};
  if (!email && !name) {
    return new Response(JSON.stringify({ error: 'email or name required' }), { status: 400, headers });
  }
  try {
    const result = await getSocialPresence({ email, name, city, state, expectedName });
    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'enrichment_failed' }), { status: 500, headers });
  }
}
