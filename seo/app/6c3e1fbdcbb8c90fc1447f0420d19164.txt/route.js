// IndexNow key verification file, served at https://idlookup.me/6c3e1fbdcbb8c90fc1447f0420d19164.txt
// IndexNow (Bing/Yandex/Seznam) fetches this to confirm we own the key we submit URLs with. The file's
// body MUST equal the key exactly. This key is PUBLIC by design (it's hosted publicly) — not a secret.
// Implemented as a route handler (not a public/ static file) to match the existing sitemap routes and
// guarantee it deploys. Reused by scripts/indexnow-submit.mjs.
export const dynamic = 'force-static';
export const INDEXNOW_KEY = '6c3e1fbdcbb8c90fc1447f0420d19164';

export async function GET() {
  return new Response(INDEXNOW_KEY, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400' },
  });
}
