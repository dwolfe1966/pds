// Name-in-city — /people/{state}/{city}/{first-last}, e.g. /people/tx/houston/john-smith.
// The leaf of the state → city → name taxonomy: name statistics scoped to the city +
// a SERP hand-off that carries state (teaser resolves) + city (client-side narrows).
import { notFound } from 'next/navigation';
import { getNameInCity, getCityTopNames } from '../../../../../lib/directory';
import { getCityAcs, getFirstNameFacts, getSurnameFacts, cityStats, nameProse } from '../../../../../lib/facts';
import { cityNamePath, cityPath, statePath } from '../../../../../lib/ids';
import { crumbsJsonLd } from '../../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../../lib/ui';
import { SITE, MAIN } from '../../../../../lib/site';

export const revalidate = 5184000; // 60d

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const serpHref = (first, last, state, city) =>
  `${MAIN}/name/search-result?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}&state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}&utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory`;

export async function generateMetadata({ params }) {
  const { state, city, name } = await params;
  const d = getNameInCity(state, city, name);
  if (!d) return { title: 'Not found' };
  const full = `${d.first} ${d.last}`;
  return {
    title: `${full} in ${d.city}, ${d.state} — Find & Search | IDLookup`,
    description: `Looking for ${full} in ${d.city}, ${d.stateName}? Search by age and relatives to find the right ${full} in ${d.city}. Addresses, phone numbers, and public records.`,
    alternates: { canonical: `${SITE}${cityNamePath(state, city, name)}` },
  };
}

const stat = {
  wrap: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 },
  card: { flex: '1 1 200px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', fontWeight: 700 },
  big: { fontSize: 24, fontWeight: 800, color: '#0d5d2f', margin: '2px 0 4px' },
  sub: { fontSize: 13, color: '#374151' },
};

export default async function NameInCity({ params }) {
  const { state, city, name } = await params;
  const d = getNameInCity(state, city, name);
  if (!d) notFound();

  const full = `${d.first} ${d.last}`;
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: d.stateName, path: statePath(state) },
    { name: d.city, path: cityPath(state, city) },
    { name: full, path: cityNamePath(state, city, name) },
  ];
  const ordinal = (r) => (r ? `#${num(r)}` : '');
  const related = getCityTopNames(state, city, 60).filter((r) => r.slug !== name).slice(0, 8);

  const ff = getFirstNameFacts(d.first);
  const lf = getSurnameFacts(d.last);
  const acs = getCityAcs(d.state, city);
  const cityFacts = cityStats(acs).slice(0, 4);
  const prose = nameProse({ full, first: d.first, last: d.last, city: d.city, stateName: d.stateName, estInCity: d.estInCity, acs, ff, lf, slugKey: name });
  const genderLabel = ff?.gender === 'unisex' ? 'Unisex' : ff?.gender === 'female' ? 'Female' : ff?.gender === 'male' ? 'Male' : null;
  const topEth = lf && [['White', lf.pctWhite], ['Hispanic', lf.pctHispanic], ['Black', lf.pctBlack], ['Asian/PI', lf.pctApi]]
    .filter(([, v]) => v != null).sort((a, b) => b[1] - a[1])[0];

  return (
    <main style={ui.main}>
      <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>{full} in {d.city}, {d.state}</h1>
      <p style={{ margin: '0 0 20px', fontSize: 17, lineHeight: 1.6 }}>
        An estimated <strong>{num(d.estInCity)}</strong> people named {full} live in {d.city}, {d.stateName}.
        Search below to find the specific {full} you're looking for in {d.city}.
      </p>

      <a href={serpHref(d.first, d.last, d.state, d.city)} style={{ ...ui.cta, fontSize: 16 }}>Search {full} in {d.city} →</a>

      <div style={{ ...stat.wrap, marginTop: 20 }}>
        <div style={stat.card}>
          <div style={stat.label}>First name</div>
          <div style={stat.big}>{d.first}</div>
          <div style={stat.sub}>
            {d.firstRank ? <>{ordinal(d.firstRank)} most common first name in the U.S.</> : 'A U.S. given name'}
            {genderLabel && <> · {genderLabel}</>}
            {ff?.peakDecade && <> · peaked {ff.peakDecade}</>}
          </div>
        </div>
        <div style={stat.card}>
          <div style={stat.label}>Surname</div>
          <div style={stat.big}>{d.last}</div>
          <div style={stat.sub}>
            {d.lastRank ? <>{ordinal(d.lastRank)} most common surname in the U.S.</> : 'A U.S. surname'}
            {topEth && topEth[1] >= 40 && <> · {topEth[1]}% {topEth[0]}</>}
          </div>
        </div>
      </div>

      {prose && (
        <p style={{ margin: '4px 0 16px', fontSize: 15, lineHeight: 1.65, color: '#374151' }}>{prose}</p>
      )}

      {cityFacts.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>About {d.city}, {d.state}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {cityFacts.map((s) => (
              <div key={s.label} style={{ background: '#f8faf9', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                <div style={stat.label}>{s.label}</div>
                <div style={{ ...stat.big, fontSize: 20 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>Source: U.S. Census Bureau, American Community Survey (5-year).</p>
        </section>
      )}

      {related.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Other names in {d.city}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            {related.map((r) => (
              <a key={r.slug} href={cityNamePath(state, city, r.slug)} style={ui.link}>{r.name}</a>
            ))}
          </div>
        </section>
      )}

      <FcraFooter />
    </main>
  );
}
