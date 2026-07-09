// State landing — /people/{state}, e.g. /people/tx. The lead of the state-first
// surface: a data-driven city dot-map, the most common names in the state (→
// name-in-state pages), and major cities. All public-domain Census data.
import { notFound } from 'next/navigation';
import { getStateSlice, getStateTopNames } from '../../../lib/directory';
import { statePath, stateNamePath } from '../../../lib/ids';
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
    title: `People Search in ${st.name} — Find Anyone by Name & City | IDLookup`,
    description: `Search for people in ${st.name}. Browse the most common names in ${st.name}, explore ${st.cities.length}+ cities, and find addresses, phone numbers, ages, and relatives.`,
    alternates: { canonical: `${SITE}${statePath(state)}` },
  };
}

export default async function StateLanding({ params }) {
  const { state } = await params;
  const st = getStateSlice(state);
  if (!st) notFound();

  const names = getStateTopNames(state, 48);
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: st.name, path: statePath(state) },
  ];
  const items = names.slice(0, 25).map((n) => ({ name: `${n.name} in ${st.name}`, path: stateNamePath(state, n.slug) }));
  const jsonLd = [
    collectionJsonLd({ name: `People Search in ${st.name}`, description: `The most common names and cities in ${st.name}.`, url: `${SITE}${statePath(state)}`, items }),
    crumbsJsonLd(crumbs),
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>People Search in {st.name}</h1>
      <p style={{ ...ui.muted, margin: '0 0 18px', fontSize: 15 }}>
        {st.name} has a population of about <strong>{num(st.pop)}</strong> across {st.cities.length}+ cities and towns.
        Browse the most common names below, or search for a specific person.
      </p>

      <StateMap cities={st.cities} name={st.name} />

      <section style={{ ...ui.card, marginTop: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Most common names in {st.name}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px 16px' }}>
          {names.map((n) => (
            <a key={n.slug} href={stateNamePath(state, n.slug)} style={{ ...ui.link, fontSize: 14 }}>
              {n.name} <span style={ui.muted}>(~{num(n.estInState)})</span>
            </a>
          ))}
        </div>
      </section>

      <section style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Major cities in {st.name}</h2>
        <p style={{ fontSize: 14, lineHeight: 1.8, margin: 0 }}>
          {st.cities.slice(0, 20).map((c, i) => (
            <span key={c.city}>{i > 0 && ' · '}{c.city} <span style={ui.muted}>({num(c.pop)})</span></span>
          ))}
        </p>
      </section>

      <a href={`${MAIN}/name/landing/v2?utm_source=seo&utm_medium=organic&state=${st.code}`} style={ui.cta}>Search people in {st.name} →</a>

      <FcraFooter />
    </main>
  );
}
