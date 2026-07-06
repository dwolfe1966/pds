// /people — the directory index. Entry point + hub for the name graph. Phase 0
// lists the available name hubs from fixtures; TODO(BC): back with the top-N of
// the Layer-1 ranked skeleton (seo/data/name-pairs.ndjson) as an A–Z / top-names
// index once live.
import { getNameIndex } from '../../lib/data';
import { collectionJsonLd, crumbsJsonLd } from '../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../lib/ui';
import { SITE } from '../../lib/site';

export const revalidate = 5184000; // 60d

export async function generateMetadata() {
  return {
    title: 'People Search — Find Anyone in the United States | IDLookup',
    description: 'Search hundreds of millions of people in the US by name. Find current addresses, phone numbers, email addresses, relatives, and public records.',
    alternates: { canonical: `${SITE}/people` },
  };
}

export default async function PeopleIndex() {
  const names = await getNameIndex();
  const crumbs = [{ name: 'People Search', path: '/people' }];
  const items = names.map((n) => ({ name: `${n.firstName} ${n.lastName}`, path: `/people/${n.slug}` }));
  const jsonLd = [
    collectionJsonLd({ name: 'People Search — IDLookup', description: 'Browse people in the United States by name.', url: `${SITE}/people`, items }),
    crumbsJsonLd(crumbs),
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>People Search</h1>
      <p style={{ ...ui.muted, margin: '0 0 20px' }}>
        Find anyone in the United States. Browse profiles by name to see age, current and past
        addresses, phone numbers, email addresses, relatives, and public records.
      </p>

      <section style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Browse names</h2>
        {names.map((n) => (
          <p key={n.slug} style={{ margin: '6px 0' }}>
            <a href={`/people/${n.slug}`} style={ui.link}>{n.firstName} {n.lastName}</a>
            <span style={ui.muted}> ({n.count})</span>
          </p>
        ))}
      </section>

      <FcraFooter />
    </main>
  );
}
