// Shared "name in STATE" view (city-generalized). Serves the recovery URLs that Google
// indexed from an older structure — BOTH forms 404'd before:
//   /<state>/<name>          (root)            → app/[state]/[name]/page.js
//   /people/<state>/<name>   (under /people)   → app/people/[state]/[city]/page.js fallback
// Both render this one view and share ONE canonical (the /people form) to avoid duplicate
// content. State analog of the leaf name-in-city page.
import { getStateSlice, getNameInState, getStateTopNames, getStateCities } from './directory';
import { getFirstNameFacts, getSurnameFacts } from './facts';
import { rosterByNameState } from './incarceration.mjs';
import { nameFromSlug, statePath, cityPath } from './ids';
import { crumbsJsonLd } from './schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from './ui';
import { SITE, MAIN } from './site';

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));

// OBIS appends the county of conviction to each charge, e.g. "FELONY BATTERY (SARASOTA)". Pull the first one
// out to show as the record's location, and strip it off the charge text so charges read cleanly.
function splitCounty(charges) {
  let county = null;
  const cleaned = (charges || []).map((c) => {
    const s = String(c);
    const m = s.match(/\s*\(([A-Z][A-Z .'-]+)\)\s*$/);
    if (m) { if (!county) county = m[1].trim(); return s.slice(0, m.index).trim(); }
    return s;
  });
  return { county, cleaned };
}

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

/** The rendered view. Callers should have already resolved/notFound()'d. Async: fetches the first-party
 *  incarceration roster (DB-only, ISR-cached with the page) to differentiate this name-in-state page. */
export async function NameInStateView({ state, name }) {
  const r = resolveNameInState(state, name);
  if (!r) return null;
  const { st, d, first, last, full } = r;

  // FIRST-PARTY DIFFERENTIATION: real incarceration records for this name in this state, from our own roster
  // (fl_inmates for FL + inmates). State-grain data on a state-grain page. Self-gating where no coverage.
  const inmates = await rosterByNameState({ state: st.code, firstName: first, lastName: last, limit: 12 });

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

      {inmates.length > 0 && (
        <section style={{ ...stat.card, flex: '1 1 100%', marginTop: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Incarceration records for {full} in {st.name} ({inmates.length})</h2>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
            Public booking &amp; incarceration records matching this name in {st.name}, from state and county correctional sources.
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {inmates.map((rec, i) => {
              const { county, cleaned } = splitCounty(rec.charges);
              const loc = [rec.facility, [(rec.county || county) ? `${(rec.county || county)} County` : null, rec.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
              return (
                <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, color: '#111827' }}>{rec.name}{rec.age ? `, ${rec.age}` : ''}</div>
                  {loc && <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>📍 {loc}</div>}
                  {cleaned.length > 0 && (
                    <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 3 }}>⚖️ {cleaned.slice(0, 2).join(' · ')}{cleaned.length > 2 ? ` +${cleaned.length - 2} more` : ''}</div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>Source: state DOC &amp; county correctional rosters. Public record, not a consumer report.</p>
        </section>
      )}

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
