// Name-in-county — /people/{state}/county/{county}/{first-last}, e.g.
// /people/fl/county/miami-dade/jose-rodriguez. The county-grain leaf: a person's public incarceration
// records in one county. County is incarceration data's finest grain, so this carries combo-unique
// first-party content with no cross-city duplication → indexable when records exist.
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getStateSlice } from '../../../../../../lib/directory';
import { countyFromSlug, rosterByNameCounty } from '../../../../../../lib/incarceration.mjs';
import { InmateRecordsSection } from '../../../../../../lib/inmate-records';
import { nameFromSlug, statePath } from '../../../../../../lib/ids';
import { crumbsJsonLd } from '../../../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../../../lib/ui';
import { SITE, MAIN } from '../../../../../../lib/site';

export const revalidate = 5184000; // 60d
export function generateStaticParams() { return []; }

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const NAME_SLUG_RE = /^[a-z]+(?:-[a-z]+)+$/;
const countyNamePath = (state, cty, slug) => `/people/${String(state).toLowerCase()}/county/${cty}/${slug}`;
const serpHref = (first, last, state) =>
  `${MAIN}/name/search-result?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}&state=${encodeURIComponent(state)}&utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory`;

// One roster fetch shared between generateMetadata (robots) and the body (React cache() dedupes/request).
const recordsFor = cache((state, county, first, last) =>
  rosterByNameCounty({ state, county, firstName: first, lastName: last, limit: 20 }));

/** Resolve state + county + name; null when any part is invalid. */
async function resolve(state, county, name) {
  const st = getStateSlice(state);
  if (!st || !NAME_SLUG_RE.test(name)) return null;
  const c = await countyFromSlug(state, county);
  if (!c) return null;
  const parsed = nameFromSlug(name);
  const full = [parsed.firstName, parsed.lastName].filter(Boolean).join(' ');
  if (!full) return null;
  return { st, c, first: parsed.firstName, last: parsed.lastName, full };
}

export async function generateMetadata({ params }) {
  const { state, county, name } = await params;
  const r = await resolve(state, county, name);
  if (!r) return { title: 'Not found', robots: { index: false, follow: true } };
  const recs = await recordsFor(r.st.code, r.c.slug, r.first, r.last);
  return {
    title: `${r.full} in ${r.c.name} County, ${r.st.code} — Incarceration Records | IDLookup`,
    description: `Public booking & incarceration records for ${r.full} in ${r.c.name} County, ${r.st.name}.`,
    alternates: { canonical: `${SITE}${countyNamePath(r.st.code, r.c.slug, name)}` },
    // Indexable only when this name actually has county records; else noindex the boilerplate (keep follow).
    robots: recs.length > 0 ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function NameInCounty({ params }) {
  const { state, county, name } = await params;
  const r = await resolve(state, county, name);
  if (!r) notFound();
  const { st, c, first, last, full } = r;
  const recs = await recordsFor(st.code, c.slug, first, last);

  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: st.name, path: statePath(state) },
    { name: `${c.name} County`, path: `/people/${st.code.toLowerCase()}/county/${c.slug}` },
    { name: full, path: countyNamePath(st.code, c.slug, name) },
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
      <Breadcrumbs crumbs={crumbs} />

      <section style={ui.hero}>
        <p style={ui.eyebrow}>County name records</p>
        <h1 style={ui.h1}>{full} in {c.name} County, {st.code}</h1>
        <p style={ui.lead}>
          {recs.length > 0
            ? <><strong>{recs.length}</strong> public incarceration {recs.length === 1 ? 'record' : 'records'} matching {full} in {c.name} County, {st.name} — see below.</>
            : <>Search for {full} in {c.name} County, {st.name}. Public booking and incarceration records from state and county correctional rosters.</>}
        </p>

        <a href={serpHref(first, last, st.code)} style={{ ...ui.cta, fontSize: 16 }}>Search {full} in {st.name} →</a>
      </section>

      <InmateRecordsSection
        records={recs}
        heading={`Incarceration records for ${full} in ${c.name} County (${recs.length})`}
        blurb={`Public booking & incarceration records matching this name in ${c.name} County, ${st.name}.`}
      />

      <p style={{ margin: '16px 0 0', fontSize: 13 }}>
        <a href={`/people/${st.code.toLowerCase()}/county/${c.slug}`} style={ui.secondaryCta}>All records in {c.name} County</a>
      </p>
      <FcraFooter />
    </main>
  );
}
