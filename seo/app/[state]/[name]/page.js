// Root-level name-in-STATE page — /{state}/{first-last}, e.g. /ca/david-johnson.
//
// RECOVERY ROUTE: these root URLs (state + name, NO city) were indexed by Google from an
// older structure and were 404ing — bleeding traffic + ranking. This serves them a real,
// city-generalized 200 page (the state analog of /people/{state}/{city}/{name}) so the
// indexed URLs recover. Self-canonical. Static segments (/people, /profiles, /api) win over
// this dynamic root route, and non-state slugs notFound(), so the catch-all stays contained.
import { notFound } from 'next/navigation';
import { getStateSlice, getNameInState, getStateTopNames } from '../../../lib/directory';
import { getFirstNameFacts, getSurnameFacts } from '../../../lib/facts';
import { nameFromSlug, statePath, cityPath } from '../../../lib/ids';
import { getStateCities } from '../../../lib/directory';
import { crumbsJsonLd } from '../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../lib/ui';
import { SITE, MAIN } from '../../../lib/site';

export const revalidate = 5184000; // 60d

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const rootNamePath = (state, slug) => `/${String(state).toLowerCase()}/${slug}`;
const serpHref = (first, last, state) =>
  `${MAIN}/name/search-result?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}&state=${encodeURIComponent(state)}&utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory`;

// A slug must look like a person name (letters + hyphens), not a stray path. Guards the
// root catch-all against rendering for non-name URLs.
const NAME_SLUG_RE = /^[a-z]+(?:-[a-z]+)+$/;

export async function generateMetadata({ params }) {
  const { state, name } = await params;
  const st = getStateSlice(state);
  if (!st || !NAME_SLUG_RE.test(name)) return { title: 'Not found' };
  const { firstName, lastName } = nameFromSlug(name);
  const full = [firstName, lastName].filter(Boolean).join(' ');
  return {
    title: `${full} in ${st.name} — Find & Search | IDLookup`,
    description: `Looking for ${full} in ${st.name}? Search by city, age, and relatives to find the right ${full}. Addresses, phone numbers, and public records across ${st.name}.`,
    alternates: { canonical: `${SITE}${rootNamePath(state, name)}` },
  };
}

const stat = {
  wrap: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 },
  card: { flex: '1 1 200px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', fontWeight: 700 },
  big: { fontSize: 24, fontWeight: 800, color: '#0d5d2f', margin: '2px 0 4px' },
  sub: { fontSize: 13, color: '#374151' },
};

export default async function NameInState({ params }) {
  const { state, name } = await params;
  const st = getStateSlice(state);
  if (!st || !NAME_SLUG_RE.test(name)) notFound();

  // Stats when the name is in our slice (may be gated to null); fall back to slug parsing so
  // the page always renders 200 for a valid state + name-shaped slug.
  const d = getNameInState(state, name);
  const parsed = nameFromSlug(name);
  const first = d?.first || parsed.firstName;
  const last = d?.last || parsed.lastName;
  const full = [first, last].filter(Boolean).join(' ');
  if (!full) notFound();

  const ordinal = (r) => (r ? `#${num(r)}` : '');
  const ff = getFirstNameFacts(first);
  const lf = getSurnameFacts(last);
  const genderLabel = ff?.gender === 'unisex' ? 'Unisex' : ff?.gender === 'female' ? 'Female' : ff?.gender === 'male' ? 'Male' : null;
  const topEth = lf && [['White', lf.pctWhite], ['Hispanic', lf.pctHispanic], ['Black', lf.pctBlack], ['Asian/PI', lf.pctApi]]
    .filter(([, v]) => v != null).sort((a, b) => b[1] - a[1])[0];

  const cities = getStateCities(state).slice(0, 12);
  const related = getStateTopNames(state, 40).filter((r) => r.slug !== name).slice(0, 10);

  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: st.name, path: statePath(state) },
    { name: full, path: rootNamePath(state, name) },
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>{full} in {st.name}</h1>
      <p style={{ margin: '0 0 20px', fontSize: 17, lineHeight: 1.6 }}>
        {d?.estInState
          ? <>An estimated <strong>{num(d.estInState)}</strong> people named {full} live in {st.name}. Search below to find the specific {full} you're looking for.</>
          : <>Find people named {full} across {st.name}. Search by city, age, and relatives to identify the right {full}.</>}
      </p>

      <a href={serpHref(first, last, st.code)} style={{ ...ui.cta, fontSize: 16 }}>Search {full} in {st.name} →</a>

      <div style={{ ...stat.wrap, marginTop: 20 }}>
        <div style={stat.card}>
          <div style={stat.label}>First name</div>
          <div style={stat.big}>{first}</div>
          <div style={stat.sub}>
            {(d?.firstRank || ff?.rank) ? <>{ordinal(d?.firstRank || ff?.rank)} most common first name in the U.S.</> : 'A U.S. given name'}
            {genderLabel && <> · {genderLabel}</>}
            {ff?.peakDecade && <> · peaked {ff.peakDecade}</>}
          </div>
        </div>
        <div style={stat.card}>
          <div style={stat.label}>Surname</div>
          <div style={stat.big}>{last}</div>
          <div style={stat.sub}>
            {(d?.lastRank || lf?.rank) ? <>{ordinal(d?.lastRank || lf?.rank)} most common surname in the U.S.</> : 'A U.S. surname'}
            {topEth && topEth[1] >= 40 && <> · {topEth[1]}% {topEth[0]}</>}
          </div>
        </div>
      </div>

      {cities.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Search {full} by city in {st.name}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            {cities.map((c) => (
              <a key={c.slug} href={cityPath(state, c.slug)} style={ui.link}>{c.city}</a>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 13 }}>
            <a href={statePath(state)} style={ui.link}>Browse all cities in {st.name} →</a>
          </p>
        </section>
      )}

      {related.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Other names in {st.name}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            {related.map((r) => (
              <a key={r.slug} href={rootNamePath(state, r.slug)} style={ui.link}>{r.name}</a>
            ))}
          </div>
        </section>
      )}

      <FcraFooter />
    </main>
  );
}
