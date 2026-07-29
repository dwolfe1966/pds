// Shared "name in STATE" view (city-generalized). Serves the recovery URLs that Google
// indexed from an older structure — BOTH forms 404'd before:
//   /<state>/<name>          (root)            → app/[state]/[name]/page.js
//   /people/<state>/<name>   (under /people)   → app/people/[state]/[city]/page.js fallback
// Both render this one view and share ONE canonical (the /people form) to avoid duplicate
// content. State analog of the leaf name-in-city page.
import { cache } from 'react';
import { getStateSlice, getNameInState, getStateTopNames, getStateCities } from './directory';
import { getFirstNameFacts, getSurnameFacts } from './facts';
import { rosterByNameState } from './incarceration.mjs';
import { querySexOffenders } from './sexOffenderDb.mjs';
import { InmateRecordsSection } from './inmate-records';
import { SexOffenderSection } from './sex-offender-section';
import { nameFromSlug, statePath, cityPath } from './ids';
import { crumbsJsonLd } from './schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from './ui';
import { SITE, MAIN } from './site';

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));

// ONE roster fetch shared between generateMetadata (robots decision) and the page body (render).
// React cache() dedupes within a request, so the DB is hit once per page; ISR then caches the page
// for `revalidate`. This is the Step-2 indexability discriminator: a name-in-state page is indexable
// IFF it carries combo-unique first-party content (≥1 incarceration record). No records → boilerplate
// (per-name facts shared across 50 states + per-state city list shared across all names) → noindex.
const rosterFor = cache((stateCode, first, last) =>
  rosterByNameState({ state: stateCode, firstName: first, lastName: last, limit: 12 }));

// Registered sex offenders matching this name in this state (owner-cleared display). Shared metadata+body.
const soFor = cache((stateCode, first, last) =>
  querySexOffenders({ state: stateCode, firstName: first, lastName: last, limit: 12 }));

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

/** generateMetadata helper. `canonicalPath` lets both URL forms point at the /people canonical.
 *  Async: fetches the roster to set robots — indexable only when the page has first-party records. */
export async function nameInStateMetadata(state, name, canonicalPath) {
  const r = resolveNameInState(state, name);
  if (!r) return { title: 'Not found' };
  const [inmates, offenders] = await Promise.all([rosterFor(r.st.code, r.first, r.last), soFor(r.st.code, r.first, r.last)]);
  return {
    title: `${r.full} in ${r.st.name} — Find & Search | IDLookup`,
    description: `Looking for ${r.full} in ${r.st.name}? Search by city, age, and relatives to find the right ${r.full}. Addresses, phone numbers, and public records across ${r.st.name}.`,
    alternates: { canonical: `${SITE}${canonicalPath}` },
    // Step 2 (SEO recovery): indexable when the page carries combo-unique first-party content — an
    // incarceration OR sex-offender record. Else noindex the boilerplate (keep follow for link equity).
    robots: inmates.length > 0 || offenders.length > 0 ? { index: true, follow: true } : { index: false, follow: true },
  };
}


/** The rendered view. Callers should have already resolved/notFound()'d. Async: fetches the first-party
 *  incarceration roster (DB-only, ISR-cached with the page) to differentiate this name-in-state page. */
export async function NameInStateView({ state, name }) {
  const r = resolveNameInState(state, name);
  if (!r) return null;
  const { st, d, first, last, full } = r;

  // FIRST-PARTY DIFFERENTIATION: real incarceration records for this name in this state, from our own roster
  // (fl_inmates for FL + inmates). State-grain data on a state-grain page. Self-gating where no coverage.
  const inmates = await rosterFor(st.code, first, last); // cache()-shared with generateMetadata → 1 DB hit
  const offenders = await soFor(st.code, first, last);   // registered sex offenders matching this name
  // Data-driven lead fragments (differ per page → de-templated intro).
  const recordLead = [
    inmates.length ? `${inmates.length} public incarceration record${inmates.length === 1 ? '' : 's'}` : null,
    offenders.length ? `${offenders.length} registered sex-offender record${offenders.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean);

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

      <section style={ui.hero}>
        <p style={ui.eyebrow}>Name records by state</p>
        <h1 style={ui.h1}>{full} in {st.name}</h1>
        {/* De-template (Step 4): lead with the records that actually DIFFER per page (incarceration / sex-offender
            counts) instead of an identical "An estimated N people…" template, so no two name-in-state pages open
            the same way. Falls back to the estimate only when there are no records. */}
        <p style={ui.lead}>
          {recordLead.length
            ? <>Public records for <strong>{full}</strong> in {st.name}: {recordLead.join(' and ')} match this name{d?.estInState ? <>, among an estimated {num(d.estInState)} {full}s statewide</> : ''}. See the details below, or search to find the specific person.</>
            : (d?.estInState
              ? <>An estimated <strong>{num(d.estInState)}</strong> people named {full} live in {st.name}. Search by city, age, and relatives to find the specific {full} you're looking for.</>
              : <>Find people named {full} across {st.name}. Search by city, age, and relatives to identify the right {full}.</>)}
        </p>

        <a href={serpHref(first, last, st.code)} style={{ ...ui.cta, fontSize: 16 }}>Search {full} in {st.name} →</a>
      </section>

      <InmateRecordsSection
        records={inmates}
        heading={`Incarceration records for ${full} in ${st.name} (${inmates.length})`}
        blurb={`Public booking & incarceration records matching this name in ${st.name}, from state and county correctional sources.`}
      />

      <SexOffenderSection
        records={offenders}
        heading={`Registered sex offenders named ${full} in ${st.name} (${offenders.length})`}
        blurb={`Public sex-offender registry records matching this name in ${st.name}.`}
      />

      {/* De-template (Step 4): the two large "First name / Surname" stat cards were IDENTICAL across all 50
          states for a given name (pure cross-page boilerplate). Demoted to one compact context line so the
          unique per-page content (records, above) dominates. */}
      {(ff || lf) && (
        <p style={{ margin: '18px 0', fontSize: 13.5, color: ui.color.muted, lineHeight: 1.6 }}>
          <strong>{first}</strong> {(d?.firstRank || ff?.rank) ? <>is the {ordinal(d?.firstRank || ff?.rank)} most common U.S. first name</> : 'is a U.S. given name'}{genderLabel ? ` (${genderLabel})` : ''}; <strong>{last}</strong> {(d?.lastRank || lf?.rank) ? <>the {ordinal(d?.lastRank || lf?.rank)} most common surname</> : 'a U.S. surname'}{topEth && topEth[1] >= 40 ? `, ${topEth[1]}% ${topEth[0]}` : ''}.
        </p>
      )}

      {cities.length > 0 && (
        <section style={ui.card}>
          <h2 style={ui.h2}>Search {full} by city in {st.name}</h2>
          <div style={ui.linkGrid}>
            {cities.map((c) => (<a key={c.slug} href={cityPath(state, c.slug)} style={ui.link}>{c.city}</a>))}
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 13 }}>
            <a href={statePath(state)} style={ui.secondaryCta}>Browse all cities in {st.name}</a>
          </p>
        </section>
      )}

      {related.length > 0 && (
        <section style={ui.card}>
          <h2 style={ui.h2}>Other names in {st.name}</h2>
          <div style={ui.linkGrid}>
            {related.map((rn) => (<a key={rn.slug} href={nameInStatePath(state, rn.slug)} style={ui.link}>{rn.name}</a>))}
          </div>
        </section>
      )}

      <FcraFooter />
    </main>
  );
}
