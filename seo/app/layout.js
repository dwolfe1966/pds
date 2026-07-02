import { orgJsonLd } from '../lib/schema';

export const metadata = {
  title: 'IDLookup.AI People Search',
  // Phase 0: the whole surface ships noindex — proof-of-crawl (GSC URL
  // Inspection, view-source) works without indexing. Indexing switches on with
  // the STAGED rollout (plan §0.5), deliberately, not by default.
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
