import { NextResponse } from 'next/server';

// Legacy URL recovery. The real-profile pages once lived at /people/<first-last>/<state>/<city>/<id>
// (name-first). Then /people/ was taken over by the Census directory (state-first:
// /people/<state>/<city>/<name>) and the profile pages moved to /profiles/<first-last>/... Google
// still has the old name-first /people/<name>/... URLs → 404 (Search Console, 2026-07-14).
//
// Discriminator: the FIRST segment after /people/ is a hyphenated NAME (first-last), never a
// 2-letter state — so redirect those, prefix-swapped, to their /profiles home (301). State-first
// URLs (/people/<state>/..., seg1 = 2-letter code, no hyphen) are untouched and route normally.
export function middleware(req) {
  const { pathname } = req.nextUrl;
  const m = pathname.match(/^\/people\/([^/]+)(\/.*)?$/);
  if (m && m[1].includes('-')) {
    const url = req.nextUrl.clone();
    url.pathname = `/profiles/${m[1]}${m[2] || ''}`;
    return NextResponse.redirect(url, 301);
  }
  return NextResponse.next();
}

export const config = { matcher: '/people/:path*' };
