// robots.txt for the SEO surface. On the dedicated prototype domain (idlookup.me)
// this app IS the whole site, so we allow all + reference our sitemaps.
// The taxonomy is ~600k+ URLs, so the sitemap is CHUNKED (app/sitemap.js
// generateSitemaps → /sitemap/{id}.xml). Next doesn't serve a /sitemap.xml index
// here, so we list every chunk directly — Google accepts multiple Sitemap: lines.
// (When this moves behind idlookup.ai/people/* the MAIN site's robots governs crawl.)
import { getSitemapUrls } from '../lib/data';
import { SITE } from '../lib/site';

const CHUNK = 45000; // must match app/sitemap.js

export default async function robots() {
  const urls = await getSitemapUrls();
  const n = Math.max(1, Math.ceil(urls.length / CHUNK));
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: Array.from({ length: n }, (_, id) => `${SITE}/sitemap/${id}.xml`),
    host: SITE,
  };
}
