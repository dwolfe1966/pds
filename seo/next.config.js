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

  // Root → /people at the EDGE. A page-level redirect() in a statically-prerendered
  // root page generates an `__next_error__` prerender (top-level browser hits follow
  // the 307 header fine, but RSC prefetch / client-nav get the error component and
  // see an error). An edge redirect happens before any render → no error document.
  async redirects() {
    return [{ source: '/', destination: '/people', permanent: false }];
  },
};

module.exports = nextConfig;
