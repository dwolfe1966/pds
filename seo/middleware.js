import { NextResponse } from 'next/server';

// Legacy URL recovery (rewritten 2026-07-28, verified live by seo-auditor). Per-individual profile pages went
// through: name-first /people/<name>/<state>/<city>/<id> → /profiles/<name>/... → and now the /people tree is
// a state-first Census directory. The /profiles route was DELETED, and the old middleware still 301'd to it —
// redirecting Google's old URLs into a 404 (GSC: 1,423 "Not found" + "Page with redirect").
//
// TARGET = name-in-state /people/<state>/<name> (measured 200 + indexable for ANY name). NOT the legacy
// city/id grain: the state-first directory only carries top-N names per city, so /people/<state>/<city>/<name>
// 404s for legacy profiles (auditor measured /people/mi/detroit/richard-gonzalez → 404). Dropping to
// name-in-state is the robust recoverable target and preserves link equity to a real indexable page.
// No usable 2-letter state → 410 Gone (clears the bucket faster than a 404).
//
// Discriminator: current state-first /people URLs have seg1 = a 2-letter state (no hyphen) and pass through;
// legacy name-first /people URLs have seg1 = a hyphenated <first-last> name. /profiles/* is always legacy.
export function middleware(req) {
  const { pathname } = req.nextUrl;
  const segs = pathname.split('/').filter(Boolean); // e.g. ['profiles','john-williams','tx','spring']

  let legacy = false, name, state;
  if (segs[0] === 'profiles') {
    legacy = true; name = segs[1]; state = segs[2];
  } else if (segs[0] === 'people' && segs[1] && segs[1].includes('-')) {
    legacy = true; name = segs[1]; state = segs[2]; // hyphen in seg1 ⇒ legacy name-first
  }
  if (!legacy) return NextResponse.next(); // current state-first URL — route normally

  if (name && state && /^[a-z]{2}$/i.test(state)) {
    const url = req.nextUrl.clone();
    url.pathname = `/people/${state.toLowerCase()}/${name.toLowerCase()}`; // name-in-state (200 + indexable)
    return NextResponse.redirect(url, 301);
  }
  return new NextResponse(null, { status: 410 }); // no usable state (bare /profiles, name-only) → Gone
}

export const config = { matcher: ['/people/:path*', '/profiles/:path*'] };
