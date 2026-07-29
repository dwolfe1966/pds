// robots.txt for the SEO surface. On the dedicated prototype domain (idlookup.me) this app IS the whole
// site, so we allow all and point at one canonical flat sitemap:
//   - /sitemap-directory.xml — the QUALITY directory core: root + state + city pages.
// Deliberately NOT the old /sitemap.xml index (360k thin URLs across 8 chunks) or the duplicate
// /sitemapv2.xml subset. Re-flooding a recovering young domain and submitting overlapping sitemap
// files makes GSC noisier without adding crawl coverage.
// (When this moves behind idlookup.ai/people/* the MAIN site's robots governs crawl.)
import { SITE } from '../lib/site';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE}/sitemap-directory.xml`,
    host: SITE,
  };
}
