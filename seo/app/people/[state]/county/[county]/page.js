// County hub — /people/{state}/county/{county}, e.g. /people/fl/county/miami-dade.
// The county grain is incarceration data's natural finest grain (records carry county, not city), so this
// is a genuinely differentiated, non-boilerplate page: real names with booking/incarceration records in
// the county, ranked by count. Static `county` segment resolves before the sibling `[city]` route.
import { notFound } from 'next/navigation';
import { getStateSlice } from '../../../../../lib/directory';
import { countyFromSlug, rosterTopNamesByCounty } from '../../../../../lib/incarceration.mjs';
import { statePath } from '../../../../../lib/ids';
import { collectionJsonLd, crumbsJsonLd } from '../../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../../lib/ui';
import { SITE, MAIN } from '../../../../../lib/site';

export const revalidate = 5184000; // 60d
export function generateStaticParams() { return []; }

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const countyNamePath = (state, cty, slug) => `/people/${String(state).toLowerCase()}/county/${cty}/${slug}`;

export async function generateMetadata({ params }) {
  const { state, county } = await params;
  const st = getStateSlice(state);
  const c = st && await countyFromSlug(state, county);
  if (!st || !c) return { title: 'Not found', robots: { index: false, follow: true } };
  return {
    title: `Inmate & Incarceration Records in ${c.name} County, ${st.code} | IDLookup`,
    description: `Search public booking, jail, and incarceration records for people in ${c.name} County, ${st.name}. ${num(c.count)} records from state and county correctional rosters.`,
    alternates: { canonical: `${SITE}/people/${String(state).toLowerCase()}/county/${c.slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function CountyHub({ params }) {
  const { state, county } = await params;
  const st = getStateSlice(state);
  const c = st && await countyFromSlug(state, county);
  if (!st || !c) notFound();

  const names = await rosterTopNamesByCounty({ state: st.code, county: c.slug, limit: 60 });
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: st.name, path: statePath(state) },
    { name: `${c.name} County`, path: `/people/${st.code.toLowerCase()}/county/${c.slug}` },
  ];
  const items = names.slice(0, 25).map((n) => ({ name: `${n.name} in ${c.name} County`, path: countyNamePath(st.code, c.slug, n.slug) }));
  const jsonLd = [
    collectionJsonLd({ name: `Incarceration records in ${c.name} County, ${st.name}`, description: `People with public incarceration records in ${c.name} County.`, url: `${SITE}/people/${st.code.toLowerCase()}/county/${c.slug}`, items }),
    crumbsJsonLd(crumbs),
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>Incarceration Records in {c.name} County, {st.code}</h1>
      <p style={{ margin: '0 0 20px', fontSize: 17, lineHeight: 1.6 }}>
        <strong>{num(c.count)}</strong> public booking &amp; incarceration records in {c.name} County, {st.name},
        from state and county correctional rosters. Browse by name below, or search directly.
      </p>

      <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory&state=${st.code}`} style={ui.cta}>
        Search {c.name} County records →
      </a>

      {names.length > 0 && (
        <section style={{ ...ui.card, marginTop: 20 }}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>People with records in {c.name} County</h2>
          <p style={{ ...ui.muted, margin: '0 0 10px', fontSize: 14 }}>Ranked by number of matching records. Pick a name to see the records.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            {names.map((n) => (
              <a key={n.slug} href={countyNamePath(st.code, c.slug, n.slug)} style={{ ...ui.link, fontSize: 14 }}>
                {n.name}{n.count ? <span style={ui.muted}> ({num(n.count)})</span> : null}
              </a>
            ))}
          </div>
        </section>
      )}

      <p style={{ margin: '16px 0 0', fontSize: 13 }}>
        <a href={statePath(state)} style={ui.link}>← All incarceration records in {st.name}</a>
      </p>
      <FcraFooter />
    </main>
  );
}
