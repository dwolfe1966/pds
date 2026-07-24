/** @type {import('next').NextConfig} */
// Production config for the SEO surface (deployed to Vercel; served on
// idlookup.ai/people/* via the Cloudflare path-split — see DEPLOY.md).
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  // Keep URLs canonical + trailing-slash-free (canonicals in metadata match).
  trailingSlash: false,
  // The SEO tree is server-rendered HTML; no image optimization needed (and the
  // profile pages carry no <Image>). Left default; revisit if we add photos.

  // NOTE: the root `/` → `/people` redirect was REMOVED 2026-07-24. Bing + GSC won't index a home domain
  // that is a 3xx redirect ("the home domain must have content and can't be a redirect"). `/` now serves a
  // real, indexable homepage (app/page.js) that links into the /people directory.
};

module.exports = nextConfig;
