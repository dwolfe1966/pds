// State landing — /people/{state}, e.g. /people/tx. Lead of the state → city → name
// taxonomy: a data-driven city dot-map and the state's cities, each linking to a
// city landing. All public-domain Census data.
import { notFound } from 'next/navigation';
import { getStateSlice, getStateCities } from '../../../lib/directory';
import { statePath, cityPath } from '../../../lib/ids';
import { collectionJsonLd, crumbsJsonLd } from '../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../lib/ui';
import { StateMap } from '../../../lib/statemap';
import { SITE, MAIN } from '../../../lib/site';

export const revalidate = 5184000; // 60d

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));

export async function generateMetadata({ params }) {
  const { state } = await params;
  const st = getStateSlice(state);
  if (!st) return { title: 'Not found' };
  return {
    title: `People Search in ${st.name} — Find Anyone by City & Name | IDLookup`,
    description: `Search for people in ${st.name}. Browse ${st.cities.length}+ cities in ${st.name} to find addresses, phone numbers, ages, and relatives.`,
    alternates: { canonical: `${SITE}${statePath(state)}` },
  };
}

export default async function StateLanding({ params }) {
  const { state } = await params;
  const st = getStateSlice(state);
  if (!st) notFound();

  const cities = getStateCities(state);
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: st.name, path: statePath(state) },
  ];
  const items = cities.slice(0, 25).map((c) => ({ name: `People in ${c.city}, ${st.code}`, path: cityPath(state, c.slug) }));
  const jsonLd = [
    collectionJsonLd({ name: `People Search in ${st.name}`, description: `Cities in ${st.name}.`, url: `${SITE}${statePath(state)}`, items }),
    crumbsJsonLd(crumbs),
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>People Search in {st.name}</h1>
      <p style={{ ...ui.muted, margin: '0 0 18px', fontSize: 15 }}>
        {st.name} has a population of about <strong>{num(st.pop)}</strong> across {st.cities.length}+ cities and towns.
        Pick a city to browse people by name, or search directly.
      </p>

      <StateMap cities={st.cities} name={st.name} />

      <section style={{ ...ui.card, marginTop: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Browse {st.name} by city</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 16px' }}>
          {cities.map((c) => (
            <a key={c.slug} href={cityPath(state, c.slug)} style={{ ...ui.link, fontSize: 14 }}>
              {c.city} <span style={ui.muted}>({num(c.pop)})</span>
            </a>
          ))}
        </div>
      </section>

      <a href={`${MAIN}/name/landing/v2?utm_source=seo&utm_medium=organic&state=${st.code}`} style={ui.cta}>Search people in {st.name} →</a>

      <FcraFooter />
    </main>
  );
}
