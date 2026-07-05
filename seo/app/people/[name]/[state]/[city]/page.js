// City hub — /people/{first-last}/{state}/{city}. The name's people in one city,
// links to individual profiles. On demand + ISR; 404s when empty. NOTE: this is
// 3 URL segments; the 4-segment sibling ([id]) is the leaf profile page.
import { notFound } from 'next/navigation';
import { getPeopleByNameCity } from '../../../../../lib/data';
import { personPath } from '../../../../../lib/ids';
import { stateName } from '../../../../../lib/states';
import { collectionJsonLd, crumbsJsonLd } from '../../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../../lib/ui';

export const revalidate = 5184000; // 60d

const SITE = 'https://www.idlookup.ai';
const FUNNEL = `${SITE}/name/landing/v3`;

export async function generateMetadata({ params }) {
  const { name, state, city } = await params;
  const hub = await getPeopleByNameCity(name, state, city);
  if (!hub) return { title: 'Not found' };
  const full = `${hub.firstName} ${hub.lastName}`;
  return {
    title: `${full} in ${hub.cityName}, ${hub.state} — ${hub.people.length} Found | IDLookup`,
    description: `${hub.people.length} people named ${full} in ${hub.cityName}, ${hub.state}. See ages, addresses, phone numbers, emails, and relatives.`,
    alternates: { canonical: `${SITE}/people/${name}/${state.toLowerCase()}/${city}` },
  };
}

export default async function CityHub({ params }) {
  const { name, state, city } = await params;
  const hub = await getPeopleByNameCity(name, state, city);
  if (!hub) notFound();

  const full = `${hub.firstName} ${hub.lastName}`;
  const st = stateName(hub.state);
  const url = `${SITE}/people/${name}/${state.toLowerCase()}/${city}`;
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: full, path: `/people/${name}` },
    { name: st, path: `/people/${name}/${state.toLowerCase()}` },
    { name: hub.cityName, path: url },
  ];
  const items = hub.people.map((p) => ({ name: `${p.fullName}, ${p.age}`, path: personPath(p) }));
  const jsonLd = [
    collectionJsonLd({ name: `${full} in ${hub.cityName}, ${hub.state}`, description: `${hub.people.length} people named ${full} in ${hub.cityName}, ${hub.state}.`, url, items }),
    crumbsJsonLd(crumbs),
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>{full} in {hub.cityName}, {hub.state}</h1>
      <p style={{ ...ui.muted, margin: '0 0 20px' }}>
        <strong>{hub.people.length}</strong> {hub.people.length === 1 ? 'person' : 'people'} named {full} in {hub.cityName}, {st}.
      </p>

      <section style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>People named {full} in {hub.cityName}</h2>
        {hub.people.map((p) => (
          <p key={p.id} style={{ margin: '8px 0' }}>
            <a href={personPath(p)} style={{ ...ui.link, fontWeight: 700 }}>{p.fullName}, Age {p.age}</a>
            <span style={ui.muted}>
              {' — '}{p.city}, {p.state}
              {p.aliases?.length ? ` · aka ${p.aliases[0]}` : ''}
            </span>
          </p>
        ))}
      </section>

      <a href={`${FUNNEL}?utm_source=seo&utm_medium=organic&q=${encodeURIComponent(full)}`} style={ui.cta}>Search {full} →</a>

      <FcraFooter />
    </main>
  );
}
