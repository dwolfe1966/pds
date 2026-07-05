import { orgJsonLd } from '../lib/schema';

// Canonicals + sitemap resolve against the PUBLIC domain (idlookup.ai), never the
// vercel.app deploy URL — the SEO tree lives on idlookup.ai via the Cloudflare
// path-split. See seo/DEPLOY.md.
export const metadata = {
  metadataBase: new URL('https://www.idlookup.ai'),
  title: 'IDLookup.AI People Search',
  // Phase 0: the whole surface ships noindex — proof-of-crawl (GSC URL
  // Inspection, view-source) works without indexing. Indexing switches on with
  // the STAGED rollout (plan §0.5), deliberately, not by default. Flip this to
  // { index: true, follow: true } for the first staged batch (or override
  // per-route) once the deploy + GSC proof is done.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111827', background: '#f8fafc' }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd()) }}
        />
        {children}
      </body>
    </html>
  );
}
