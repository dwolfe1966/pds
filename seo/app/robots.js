// robots.txt for the SEO surface. On the dedicated prototype domain (idlookup.me)
// this app IS the whole site, so we allow all and point at the sitemap INDEX
// (/sitemap.xml, app/sitemap.xml/route.js), which fans out to the chunked sitemaps
// (/sitemap/{id}.xml from app/sitemap.js). One URL to submit in Search Console.
// (When this moves behind idlookup.ai/people/* the MAIN site's robots governs crawl.)
import { SITE } from '../lib/site';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
