// Lightweight APP-LEVEL gate for the WSFY / enrichment endpoints. This is NOT per-user auth (that's
// the WSFY-AUTH BC ask) — it just requires our app's shared key (X-App-Key header) so the endpoints
// aren't wide open to the internet. The key ships in the consumer bundle (extractable), so it raises
// the bar against casual scraping, not a determined attacker. When WSFY_APP_KEY is unset the gate is
// OPEN (so nothing breaks before the owner sets the env on both Vercel and the consumer).
export function checkAppKey(req) {
  const want = process.env.WSFY_APP_KEY;
  if (!want) return true;
  return req.headers.get('x-app-key') === want;
}

export function unauthorized(headers) {
  return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
}
