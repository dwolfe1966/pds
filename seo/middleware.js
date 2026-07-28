import { NextResponse } from 'next/server';

// Legacy URL recovery (rewritten 2026-07-28). Profile pages went through THREE schemes:
//   1. name-first   /people/<name>/<state>/<city>/<id>
//   2. /profiles/   /profiles/<name>/<state>/<city>/<id>
//   3. state-first  /people/<state>/<city>/<name>/<id>   ← CURRENT
// The /profiles route was DELETED, but the old middleware still 301'd name-first /people/* → /profiles/* —
// i.e. redirecting Google's old URLs straight into a 404 (GSC 2026-07-28: 1,423 "Not found" + "Page with
// redirect"). Fix: remap BOTH /profiles/* and name-first /people/<name>/* to the CURRENT state-first /people
// URL by REORDERING the path segments (301). Shapes with no valid state-first target (name-only or
// name+state, no city) → 410 Gone, so Google drops them cleanly instead of chaining into another 404.
//
// Discriminator: current state-first URLs have seg1 = a 2-letter state (never hyphenated) and are left
// untouched; legacy name-first /people URLs have seg1 = a hyphenated <first-last> name.
export function middleware(req) {
  const { pathname } = req.nextUrl;

  // Identify a legacy URL and pull the <name> + the remaining tail (state/city/id).
  let name = null, rest = null;
  const prof = pathname.match(/^\/profiles\/([^/]+)(?:\/(.*))?$/);
  if (prof) {
    name = prof[1];
    rest = prof[2];
  } else {
    const ppl = pathname.match(/^\/people\/([^/]+)(?:\/(.*))?$/);
    if (ppl && ppl[1].includes('-')) { // hyphen in seg1 ⇒ legacy name-first (state codes have no hyphen)
      name = ppl[1];
      rest = ppl[2];
    }
  }
  if (name === null) return NextResponse.next(); // current state-first URL — route normally

  const tail = (rest || '').split('/').filter(Boolean); // [state, city?, id?]
  const [state, city, id] = tail;
  const url = req.nextUrl.clone();
  if (state && city && id) {
    url.pathname = `/people/${state}/${city}/${name}/${id}`;      // full profile leaf
  } else if (state && city) {
    url.pathname = `/people/${state}/${city}/${name}`;            // name-in-city page
  } else {
    return new NextResponse(null, { status: 410 });              // name-only / name+state → no home → Gone
  }
  return NextResponse.redirect(url, 301);
}

export const config = { matcher: ['/people/:path*', '/profiles/:path*'] };
