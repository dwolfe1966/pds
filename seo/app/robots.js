// robots.txt for the SEO deployment (Next 15). NOTE: this serves on the *deploy*
// origin. Google reads robots for idlookup.ai/people/* from idlookup.ai/robots.txt
// — which is the MAIN SITE's robots and must be updated (via Cloudflare/the SPA)
// to Allow: /people and reference this sitemap. See DEPLOY.md.
//
// We ALLOW crawling even in Phase 0: proof-of-crawl (Googlebot fetch + GSC URL
// Inspection) needs the bot to reach the pages; the per-page `noindex` meta
// (app/layout.js) is what withholds them from the index until the staged flip.
const SITE = 'https://www.idlookup.ai';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/people' }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
