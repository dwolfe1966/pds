// /sitemap.xml → 301 to the canonical directory sitemap.
//
// The old chunked sitemap index (which fanned out to /sitemap/{id}.xml = ~360k mostly-NOINDEX name-in-city
// URLs) was RETIRED 2026-07-28. It was never declared in robots.txt (only sitemapv2.xml + sitemap-directory.xml
// are — app/robots.js), but it still served and bled crawl budget on noindex pages (GSC: Discovered/Crawled –
// not indexed). The chunk generator (app/sitemap.js) is deleted, so /sitemap/{id}.xml now 404. This handler
// keeps a bookmarked or previously-GSC-submitted /sitemap.xml landing on a VALID clean sitemap instead of 404.
import { SITE } from '../../lib/site';

export const dynamic = 'force-static';

export function GET() {
  return new Response(null, {
    status: 301,
    headers: { Location: `${SITE}/sitemap-directory.xml` },
  });
}
