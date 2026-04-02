/**
 * Cloudflare Worker — ByteCrtrs API Proxy
 *
 * Intercepts requests to /api/proxy/* and forwards them to the BC API server-to-server,
 * bypassing the browser CORS restriction.
 *
 * Deploy in the Cloudflare dashboard:
 *   1. Workers & Pages → Create Worker → paste this file
 *   2. Add a Route on your zone: dev.www.idlookup.ai/api/proxy/* → this worker
 *
 * Environment variable (set in Worker Settings → Variables):
 *   BC_API_URL  =  https://dev1.dev.www.bytecrtrs.com/api   (or prod BC URL)
 *   CAPTCHA_PASS = bcEdgeApiPass
 */

const BC_API_URL = typeof BC_API_URL_ENV !== 'undefined'
  ? BC_API_URL_ENV
  : 'https://dev1.dev.www.bytecrtrs.com/api';

const CAPTCHA_PASS = typeof CAPTCHA_PASS_ENV !== 'undefined'
  ? CAPTCHA_PASS_ENV
  : 'bcEdgeApiPass';

// Headers that must not be forwarded to BC
const HOP_BY_HOP = new Set([
  'host', 'connection', 'keep-alive', 'proxy-authenticate',
  'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade',
  'content-length', // will be recalculated
]);

// Headers that must not be forwarded back to the browser
const STRIP_RESPONSE = new Set([
  'content-encoding', // Workers decode automatically
  'transfer-encoding',
  'connection',
]);

function getAllowedOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = [
    'https://dev.www.idlookup.ai',
    'https://www.idlookup.ai',
    'https://idlookup.ai',
  ];
  return allowed.includes(origin) ? origin : allowed[0];
}

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': getAllowedOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Captcha-Pass, X-Captcha-Id, X-Captcha-Token',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Set-Cookie',
  };
}

async function warmupCaptcha(bcPath, clientId, apiId) {
  const url = new URL(`${BC_API_URL}/captcha/verify`);
  url.searchParams.set('token', CAPTCHA_PASS);
  url.searchParams.set('type', 'password.v0');
  url.searchParams.set('step', '0-0');
  if (clientId) url.searchParams.set('clientId', clientId);
  if (apiId) url.searchParams.set('apiId', apiId);

  try {
    const res = await fetch(url.toString(), { method: 'GET' });
    const setCookie = res.headers.get('set-cookie');
    return setCookie || null;
  } catch {
    return null;
  }
}

async function handleRequest(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  const url = new URL(request.url);

  // Strip /api/proxy prefix → BC path
  const bcPath = url.pathname.replace(/^\/api\/proxy/, '');
  const bcUrl = new URL(`${BC_API_URL}${bcPath}${url.search}`);

  // Forward request headers (skip hop-by-hop)
  const forwardHeaders = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      forwardHeaders.set(key, value);
    }
  }

  // Captcha warmup: if teaser search arrives with no cookies, pre-verify
  const isSearch = bcPath.includes('/idLookup/teaser/search') && request.method === 'POST';
  const hasCookies = !!request.headers.get('cookie');

  let warmupCookie = null;
  if (isSearch && !hasCookies) {
    const clientId = bcUrl.searchParams.get('clientId');
    const apiId = bcUrl.searchParams.get('apiId');
    warmupCookie = await warmupCaptcha(bcPath, clientId, apiId);
    if (warmupCookie) {
      // Extract name=value portion and forward as Cookie header
      const cookieValue = warmupCookie.split(';')[0];
      forwardHeaders.set('Cookie', cookieValue);
    }
  }

  // Build the proxied request
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();

  const bcResponse = await fetch(bcUrl.toString(), {
    method: request.method,
    headers: forwardHeaders,
    body,
  });

  // Build response headers — forward BC headers + CORS + pass-through Set-Cookie
  const responseHeaders = new Headers();
  for (const [key, value] of bcResponse.headers.entries()) {
    if (!STRIP_RESPONSE.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  }
  // If warmup produced a cookie and BC didn't send one, forward the warmup cookie
  if (warmupCookie && !responseHeaders.has('set-cookie')) {
    responseHeaders.set('set-cookie', warmupCookie);
  }
  // Attach CORS headers
  for (const [key, value] of Object.entries(corsHeaders(request))) {
    responseHeaders.set(key, value);
  }

  const responseBody = await bcResponse.arrayBuffer();
  return new Response(responseBody, {
    status: bcResponse.status,
    statusText: bcResponse.statusText,
    headers: responseHeaders,
  });
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request).catch(err =>
    new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  ));
});
