// Guides hub — topic-cluster index for the how-to authority content (SEO WS4). Links every guide;
// each guide links back here + to the others. Not in the sitemap yet (owner) — reachable by link.
import Link from 'next/link';
import { GUIDES } from '../../lib/guides.mjs';
import { crumbsJsonLd } from '../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../lib/ui';
import { SITE } from '../../lib/site';

export const revalidate = 5184000; // 60d

export const metadata = {
  title: 'Public Records Guides — Find People, Inmates & Records | IDLookup',
  description: 'Free how-to guides for finding inmates, jail and prison records, and people across public records.',
  alternates: { canonical: `${SITE}/guides` },
};

export default function GuidesIndex() {
  const crumbs = [{ name: 'Guides', path: '/guides' }];
  return (
    <main style={ui.main}>
      <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
      <Breadcrumbs crumbs={crumbs} />
      <header style={ui.hero}>
        <p style={ui.eyebrow}>Public Records Guides</p>
        <h1 style={ui.h1}>Guides</h1>
        <p style={ui.lead}>Free, practical how-to guides for finding people and public records — starting with inmate and incarceration search.</p>
      </header>
      <section style={ui.card}>
        {GUIDES.map((g) => (
          <div key={g.path} style={{ marginBottom: 14 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>
              <Link href={g.path} style={ui.link}>{g.title} →</Link>
            </h2>
            <p style={{ margin: 0, color: ui.color.body }}>{g.blurb}</p>
          </div>
        ))}
      </section>
      <FcraFooter />
    </main>
  );
}
