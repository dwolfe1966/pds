// Name-in-city — /people/{state}/{city}/{first-last}, e.g. /people/tx/houston/john-smith.
// The leaf of the state → city → name taxonomy: name statistics scoped to the city +
// a SERP hand-off that carries state (teaser resolves) + city (client-side narrows).
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getNameInCity, getCityTopNames } from '../../../../../lib/directory';
import { getCityAcs, getFirstNameFacts, getSurnameFacts, cityStats, nameProse } from '../../../../../lib/facts';
import { cityNamePath, cityPath, statePath } from '../../../../../lib/ids';
import { crumbsJsonLd } from '../../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../../lib/ui';
import { SITE, MAIN } from '../../../../../lib/site';
import { getCapturedPeople, norm } from '../../../../../lib/search-activity-db.mjs';
import { ageToken } from '../../../../../lib/ids';

export const revalidate = 5184000; // 60d
// ISR (SEO 2026-07-18): [] + dynamicParams=true → each page is generated on first hit and CACHED for
// `revalidate` instead of live-rendering per request (which returned private/no-store and made every
// Googlebot hit a live Neon render → transient 404s). Flips this route from ƒ Dynamic → ● cached.
export function generateStaticParams() { return []; }

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));

// ONE captured-people fetch shared between generateMetadata (robots) and the page body. React cache()
// dedupes within a request → one DB hit; ISR caches the page 60d. Step 2 (SEO recovery) discriminator:
// a name-in-city page is indexable IFF we've actually CAPTURED a real individual with this name in this
// city (person_profiles). Otherwise it's ~85% shared boilerplate (per-name facts identical across every
// city + per-city ACS identical across every name) = near-dup residue that drags a recovering domain.
const capturedFor = cache((firstNorm, lastNorm, state, cityNorm) =>
  getCapturedPeople({ firstNorm, lastNorm, state, cityNorm }));

const serpHref = (first, last, state, city) =>
  `${MAIN}/name/search-result?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}&state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}&utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory`;

export async function generateMetadata({ params }) {
  const { state, city, name } = await params;
  const d = getNameInCity(state, city, name);
  if (!d) return { title: 'Not found' };
  const full = `${d.first} ${d.last}`;
  const people = await capturedFor(norm(d.first), norm(d.last), d.state, norm(d.city));
  return {
    title: `${full} in ${d.city}, ${d.state} — Find & Search | IDLookup`,
    description: `Looking for ${full} in ${d.city}, ${d.stateName}? Search by age and relatives to find the right ${full} in ${d.city}. Addresses, phone numbers, and public records.`,
    alternates: { canonical: `${SITE}${cityNamePath(state, city, name)}` },
    // Step 2 (SEO recovery): noindex the boilerplate residue (no captured individual for this name+city),
    // keep follow so link equity flows + funnel stays live. Auto-flips to indexable as the corpus grows.
    robots: people.length > 0 ? { index: true, follow: true } : { index: false, follow: true },
  };
}

const stat = {
  wrap: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 },
  card: { flex: '1 1 200px', background: '#fff', border: `1px solid ${ui.color.softBorder}`, borderRadius: 8, padding: '16px 18px', boxShadow: '0 1px 2px rgba(16, 24, 40, 0.04)' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: ui.color.muted, fontWeight: 800 },
  big: { fontSize: 24, fontWeight: 800, color: ui.color.accent, margin: '2px 0 4px' },
  sub: { fontSize: 13, color: ui.color.body },
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

  // Real individuals we've actually captured with this name in this city (person_profiles corpus) —
  // each links to its own crawlable Others-Profile leaf.
  const people = await capturedFor(norm(d.first), norm(d.last), d.state, norm(d.city)); // cache()-shared with generateMetadata → 1 DB hit

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

      <section style={ui.hero}>
        <p style={ui.eyebrow}>Name directory</p>
        <h1 style={ui.h1}>{full} in {d.city}, {d.state}</h1>
        <p style={ui.lead}>
          An estimated <strong>{num(d.estInCity)}</strong> people named {full} live in {d.city}, {d.stateName}.
          Search below to find the specific {full} you're looking for in {d.city}.
        </p>

        <a href={serpHref(d.first, d.last, d.state, d.city)} style={{ ...ui.cta, fontSize: 16 }}>Search {full} in {d.city} →</a>
      </section>

      {people.length > 0 && (
        <section style={{ ...ui.card, marginTop: 20 }}>
          <h2 style={ui.h2}>{people.length} {people.length === 1 ? 'profile' : 'profiles'} for {full} in {d.city}</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {people.map((p) => (
              <a key={p.profile_id} href={`${cityNamePath(state, city, name)}/${ageToken(p.age)}`}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: `1px solid ${ui.color.softBorder}`, borderRadius: 8, padding: '12px 14px', textDecoration: 'none', color: ui.color.ink }}>
                <span style={{ minWidth: 0 }}>
                  <strong>{p.name}</strong>{p.age ? `, ${p.age}` : ''}
                  <span style={ui.muted}> · {[p.city, p.state].filter(Boolean).join(', ')}</span>
                </span>
                <span style={{ color: ui.color.accent, fontWeight: 800, whiteSpace: 'nowrap' }}>View profile →</span>
              </a>
            ))}
          </div>
        </section>
      )}

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
        <p style={{ margin: '4px 0 16px', fontSize: 15, lineHeight: 1.65, color: ui.color.body }}>{prose}</p>
      )}

      {cityFacts.length > 0 && (
        <section style={ui.card}>
          <h2 style={ui.h2}>About {d.city}, {d.state}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {cityFacts.map((s) => (
              <div key={s.label} style={{ background: ui.color.soft, border: `1px solid ${ui.color.softBorder}`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={stat.label}>{s.label}</div>
                <div style={{ ...stat.big, fontSize: 20 }}>{s.value}</div>
              </div>
            ))}
          </div>
          <p style={ui.source}>Source: U.S. Census Bureau, American Community Survey (5-year).</p>
        </section>
      )}

      {related.length > 0 && (
        <section style={ui.card}>
          <h2 style={ui.h2}>Other names in {d.city}</h2>
          <div style={ui.linkGrid}>
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
