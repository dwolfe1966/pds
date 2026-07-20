// State landing — /people/{state}, e.g. /people/tx. Lead of the state → city → name
// taxonomy: a data-driven city dot-map and the state's cities, each linking to a
// city landing. All public-domain Census data.
import { notFound } from 'next/navigation';
import { getStateSlice, getStateCities, getStateTopNames } from '../../../lib/directory';
import { statePath, cityPath } from '../../../lib/ids';
import { collectionJsonLd, crumbsJsonLd } from '../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../lib/ui';
import { StateMap } from '../../../lib/statemap';
import { SITE, MAIN } from '../../../lib/site';

export const revalidate = 5184000; // 60d
// ISR (SEO 2026-07-18): [] + dynamicParams=true → each page is generated on first hit and CACHED for
// `revalidate` instead of live-rendering per request (which returned private/no-store and made every
// Googlebot hit a live Neon render → transient 404s). Flips this route from ƒ Dynamic → ● cached.
export function generateStaticParams() { return []; }

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
  const topNames = getStateTopNames(state, 30);
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

      {topNames.length > 0 && (
        <section style={{ ...ui.card, marginTop: 16 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Incarceration &amp; inmate records in {st.name}</h2>
          <p style={{ ...ui.muted, margin: '0 0 10px', fontSize: 14 }}>
            Search public booking, incarceration, and criminal records for people in {st.name} by name — sourced from state and county correctional rosters.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            {topNames.map((n) => (
              <a key={n.slug} href={`/people/${st.code.toLowerCase()}/${n.slug}`} style={{ ...ui.link, fontSize: 14 }}>{n.name}</a>
            ))}
          </div>
        </section>
      )}

      <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory&state=${st.code}`} style={ui.cta}>Search people in {st.name} →</a>

      <FcraFooter />
    </main>
  );
}
