// robots.txt for the SEO surface. On the dedicated prototype domain (idlookup.me)
// this app IS the whole site, so we allow all + reference our own sitemap.
// (When this moves behind idlookup.ai/people/* the MAIN site's robots.txt governs
// crawl — Allow: /people + this sitemap; see DEPLOY.md.)
import { SITE } from '../lib/site';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
