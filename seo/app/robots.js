// robots.txt for the SEO surface. On the dedicated prototype domain (idlookup.me) this app IS the whole
// site, so we allow all and point at TWO flat sitemaps (no index):
//   - /sitemapv2.xml         — conservative ~1000 high-trust state/city URLs (unchanged).
//   - /sitemap-directory.xml — the QUALITY directory core (states + cities + top ~45k name-in-city by
//     population, fresh lastmod) to re-crawl the pages fixed after the 7/12–7/15 deindex.
// Deliberately NOT the old /sitemap.xml index (360k thin URLs across 8 chunks) — re-flooding a recovering
// young domain. Widen only once Google is indexing the core again.
// (When this moves behind idlookup.ai/people/* the MAIN site's robots governs crawl.)
import { SITE } from '../lib/site';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: [`${SITE}/sitemapv2.xml`, `${SITE}/sitemap-directory.xml`],
    host: SITE,
  };
}
