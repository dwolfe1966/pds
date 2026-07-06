import { orgJsonLd } from '../lib/schema';
import { SITE } from '../lib/site';

// Canonicals + sitemap resolve against SITE (the SEO surface's own domain —
// idlookup.me for the prototype), never the vercel.app deploy URL. See lib/site.js.
export const metadata = {
  metadataBase: new URL(SITE),
  title: 'IDLookup People Search',
  // Prototype on idlookup.me is INDEXABLE — the whole point is to watch real
  // crawl + indexing in GSC. Thin combos still 404 (never enter the sitemap).
  // (On idlookup.ai this returns to a staged flip behind the path-split.)
  robots: { index: true, follow: true },
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
