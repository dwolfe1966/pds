// robots.txt for the SEO surface. On the dedicated prototype domain (idlookup.me)
// this app IS the whole site, so we allow all and point at the CONSERVATIVE flat sitemap
// (/sitemapv2.xml, app/sitemapv2.xml/route.js) — ~1000 high-trust city/state URLs, one
// <urlset>, no index. Deliberately NOT the old /sitemap.xml index (360k thin URLs across 8
// chunks) after the 7/13 crawl drop; widen once Google is crawling again.
// (When this moves behind idlookup.ai/people/* the MAIN site's robots governs crawl.)
import { SITE } from '../lib/site';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE}/sitemapv2.xml`,
    host: SITE,
  };
}
