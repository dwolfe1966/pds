// Shared "name in STATE" view (city-generalized). Serves the recovery URLs that Google
// indexed from an older structure — BOTH forms 404'd before:
//   /<state>/<name>          (root)            → app/[state]/[name]/page.js
//   /people/<state>/<name>   (under /people)   → app/people/[state]/[city]/page.js fallback
// Both render this one view and share ONE canonical (the /people form) to avoid duplicate
// content. State analog of the leaf name-in-city page.
import { getStateSlice, getNameInState, getStateTopNames, getStateCities } from './directory';
import { getFirstNameFacts, getSurnameFacts } from './facts';
import { nameFromSlug, statePath, cityPath } from './ids';
import { crumbsJsonLd } from './schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from './ui';
import { SITE, MAIN } from './site';

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));

// A slug must look like a person name (letters + hyphens), not a stray path segment.
export const NAME_SLUG_RE = /^[a-z]+(?:-[a-z]+)+$/;

// Canonical path for a name-in-state page (the /people form).
export const nameInStatePath = (state, slug) => `/people/${String(state).toLowerCase()}/${slug}`;

const serpHref = (first, last, state) =>
  `${MAIN}/name/search-result?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}&state=${encodeURIComponent(state)}&utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory`;

/** Resolve a state+name pair to render data, or null when it isn't a valid state + name slug. */
export function resolveNameInState(state, name) {
  const st = getStateSlice(state);
  if (!st || !NAME_SLUG_RE.test(name)) return null;
  const d = getNameInState(state, name); // may be null if gated; we still render (degrade)
  const parsed = nameFromSlug(name);
  const first = d?.first || parsed.firstName;
  const last = d?.last || parsed.lastName;
  const full = [first, last].filter(Boolean).join(' ');
  if (!full) return null;
  return { st, d, first, last, full };
}

/** generateMetadata helper. `canonicalPath` lets both URL forms point at the /people canonical. */
export function nameInStateMetadata(state, name, canonicalPath) {
  const r = resolveNameInState(state, name);
  if (!r) return { title: 'Not found' };
  return {
    title: `${r.full} in ${r.st.name} — Find & Search | IDLookup`,
    description: `Looking for ${r.full} in ${r.st.name}? Search by city, age, and relatives to find the right ${r.full}. Addresses, phone numbers, and public records across ${r.st.name}.`,
    alternates: { canonical: `${SITE}${canonicalPath}` },
  };
}

const stat = {
  wrap: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 },
  card: { flex: '1 1 200px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', fontWeight: 700 },
  big: { fontSize: 24, fontWeight: 800, color: '#0d5d2f', margin: '2px 0 4px' },
  sub: { fontSize: 13, color: '#374151' },
};

/** The rendered view. Callers should have already resolved/notFound()'d. */
export function NameInStateView({ state, name }) {
  const r = resolveNameInState(state, name);
  if (!r) return null;
  const { st, d, first, last, full } = r;

  const ordinal = (rk) => (rk ? `#${num(rk)}` : '');
  const ff = getFirstNameFacts(first);
  const lf = getSurnameFacts(last);
  const genderLabel = ff?.gender === 'unisex' ? 'Unisex' : ff?.gender === 'female' ? 'Female' : ff?.gender === 'male' ? 'Male' : null;
  const topEth = lf && [['White', lf.pctWhite], ['Hispanic', lf.pctHispanic], ['Black', lf.pctBlack], ['Asian/PI', lf.pctApi]]
    .filter(([, v]) => v != null).sort((a, b) => b[1] - a[1])[0];

  const cities = getStateCities(state).slice(0, 12);
  const related = getStateTopNames(state, 40).filter((rn) => rn.slug !== name).slice(0, 10);

  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: st.name, path: statePath(state) },
    { name: full, path: nameInStatePath(state, name) },
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
            {cities.map((c) => (<a key={c.slug} href={cityPath(state, c.slug)} style={ui.link}>{c.city}</a>))}
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
            {related.map((rn) => (<a key={rn.slug} href={nameInStatePath(state, rn.slug)} style={ui.link}>{rn.name}</a>))}
          </div>
        </section>
      )}

      <FcraFooter />
    </main>
  );
}
