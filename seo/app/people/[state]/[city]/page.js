// City landing — /people/{state}/{city}, e.g. /people/tx/houston. Middle of the
// state → city → name taxonomy: lists the most-common (resolvable) names in the
// city, each linking to a name-in-city page.
import { notFound } from 'next/navigation';
import { getCitySlice, getCityTopNames } from '../../../../lib/directory';
import { statePath, cityPath, cityNamePath } from '../../../../lib/ids';
import { collectionJsonLd, crumbsJsonLd } from '../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../lib/ui';
import { SITE, MAIN } from '../../../../lib/site';

export const revalidate = 5184000; // 60d

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));

export async function generateMetadata({ params }) {
  const { state, city } = await params;
  const c = getCitySlice(state, city);
  if (!c) return { title: 'Not found' };
  return {
    title: `People Search in ${c.city}, ${c.stateCode} — Find Anyone by Name | IDLookup`,
    description: `Search for people in ${c.city}, ${c.stateName}. Browse the most common names in ${c.city} and find addresses, phone numbers, ages, and relatives.`,
    alternates: { canonical: `${SITE}${cityPath(state, city)}` },
  };
}

export default async function CityLanding({ params }) {
  const { state, city } = await params;
  const c = getCitySlice(state, city);
  if (!c) notFound();

  const names = getCityTopNames(state, city, 60);
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: c.stateName, path: statePath(state) },
    { name: c.city, path: cityPath(state, city) },
  ];
  const items = names.slice(0, 25).map((n) => ({ name: `${n.name} in ${c.city}`, path: cityNamePath(state, city, n.slug) }));
  const jsonLd = [
    collectionJsonLd({ name: `People Search in ${c.city}, ${c.stateCode}`, description: `The most common names in ${c.city}, ${c.stateName}.`, url: `${SITE}${cityPath(state, city)}`, items }),
    crumbsJsonLd(crumbs),
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>People Search in {c.city}, {c.stateCode}</h1>
      <p style={{ ...ui.muted, margin: '0 0 20px', fontSize: 15 }}>
        {c.city} has a population of about <strong>{num(c.pop)}</strong>. Browse the most common names below to find a specific person, or search directly.
      </p>

      <section style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Most common names in {c.city}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 16px' }}>
          {names.map((n) => (
            <a key={n.slug} href={cityNamePath(state, city, n.slug)} style={{ ...ui.link, fontSize: 14 }}>
              {n.name} <span style={ui.muted}>(~{num(n.estInCity)})</span>
            </a>
          ))}
        </div>
      </section>

      <a href={`${MAIN}/name/landing/v2?utm_source=seo&utm_medium=organic&state=${c.stateCode}`} style={ui.cta}>Search people in {c.city} →</a>

      <FcraFooter />
    </main>
  );
}
