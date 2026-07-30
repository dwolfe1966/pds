// HomeFacts STATE hub — /homefacts/{state}, e.g. /homefacts/tx. Completes the hierarchy
// (landing → state → city/county, + zip). Lists the state's cities and counties, each linking to its area
// profile. Crawlable index page for the /homefacts section. Design: lib/hf.js.
import { notFound } from 'next/navigation';
import { getStateSlice, getStateCities, getStateTopNames } from '../../../lib/directory';
import { nameInStatePath } from '../../../lib/name-in-state';
import { rosterTopNamesByState } from '../../../lib/incarceration.mjs';
import { getCounties, hfCityPath, hfCountyPath, hfStatePath } from '../../../lib/homefacts';
import { hf, hfColor, HfHeader, HfBreadcrumbs, Section } from '../../../lib/hf';
import { crumbsJsonLd, collectionJsonLd } from '../../../lib/schema';
import { FcraFooter, JsonLd } from '../../../lib/ui';
import { SITE } from '../../../lib/site';

const withTimeout = (p, fb, ms = 5000) => Promise.race([p.catch(() => fb), new Promise((r) => setTimeout(() => r(fb), ms))]);

export const revalidate = 5184000; // 60d ISR
export function generateStaticParams() { return []; }

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));

export async function generateMetadata({ params }) {
  const { state } = await params;
  const st = getStateSlice(state);
  if (!st) return { title: 'Not found', robots: { index: false, follow: true } };
  return {
    title: `${st.name} Neighborhood Reports — Cities, Counties, Crime, Schools & Property | Homefacts`,
    description: `Area profiles for cities and counties across ${st.name}: demographics, property values, schools, crime, natural-disaster risk, environmental hazards, and the registered sex-offender registry.`,
    alternates: { canonical: `${SITE}${hfStatePath(state)}` },
  };
}

export default async function StateHub({ params }) {
  const { state } = await params;
  const st = getStateSlice(state);
  if (!st) notFound();

  const cities = getStateCities(state) || [];
  const counties = getCounties(state) || [];
  // People into the experience: statewide top incarceration names (like /people/{st}) + popular names.
  const [inmateNames, popNames] = await Promise.all([
    withTimeout(rosterTopNamesByState({ state: st.code, limit: 30 }), [], 9000),
    Promise.resolve(getStateTopNames(state, 30)),
  ]);
  const crumbs = [
    { name: 'Homefacts', path: '/homefacts' },
    { name: st.name, path: hfStatePath(state) },
  ];
  const items = cities.slice(0, 25).map((c) => ({ name: `${c.city}, ${st.code}`, path: hfCityPath(state, c.slug) }));
  const jsonLd = [
    collectionJsonLd({ name: `${st.name} Neighborhood Reports`, description: `Cities and counties across ${st.name}.`, url: `${SITE}${hfStatePath(state)}`, items }),
    crumbsJsonLd(crumbs),
  ];

  return (
    <div style={hf.page}>
      <HfHeader />
      <main style={hf.main}>
        <JsonLd blocks={jsonLd} />
        <HfBreadcrumbs crumbs={crumbs} />

        <section style={{ ...hf.card, marginBottom: 8 }}>
          <p style={hf.eyebrow}>State neighborhood reports</p>
          <h1 style={hf.h1}>{st.name}</h1>
          <p style={hf.lead}>
            Neighborhood reports for {num(cities.length)} cities and {num(counties.length)} counties in {st.name} —
            demographics, property, schools, crime, disaster &amp; environmental risk, and the sex-offender registry.
          </p>
        </section>

        {cities.length > 0 && (
          <Section id="cities" eyebrow="Browse" title={`Cities in ${st.name}`}>
            <div style={hf.linkGrid}>
              {cities.map((c) => (
                <a key={c.slug} href={hfCityPath(state, c.slug)} style={{ ...hf.link, fontSize: 14 }}>
                  {c.city}{c.pop ? <span style={{ color: hfColor.muted }}> (~{num(c.pop)})</span> : null}
                </a>
              ))}
            </div>
          </Section>
        )}

        {counties.length > 0 && (
          <Section id="counties" eyebrow="Browse" title={`Counties in ${st.name}`}>
            <div style={hf.linkGrid}>
              {counties.map((c) => (
                <a key={c.slug} href={hfCountyPath(state, c.slug)} style={{ ...hf.link, fontSize: 14 }}>{c.name} County</a>
              ))}
            </div>
          </Section>
        )}

        {inmateNames.length > 0 && (
          <Section id="incarceration" eyebrow="Public records" title={`Incarceration & inmate records in ${st.name}`}
            source="Names with the most public booking/incarceration records statewide. Source: state & county correctional rosters (first-party).">
            <div style={hf.linkGrid}>
              {inmateNames.slice(0, 30).map((n) => (
                <a key={n.slug} href={nameInStatePath(state, n.slug)} style={{ ...hf.link, fontSize: 14 }}>
                  {n.name}{n.count ? <span style={{ color: hfColor.muted }}> ({num(n.count)})</span> : null}
                </a>
              ))}
            </div>
          </Section>
        )}

        {popNames.length > 0 && (
          <Section id="names" eyebrow="People search" title={`Popular names in ${st.name}`}
            source="Common names across the state — search any by city, age, and relatives.">
            <div style={hf.linkGrid}>
              {popNames.map((n) => (
                <a key={n.slug} href={nameInStatePath(state, n.slug)} style={{ ...hf.link, fontSize: 14 }}>
                  {n.name}{n.estInState ? <span style={{ color: hfColor.muted }}> (~{num(n.estInState)})</span> : null}
                </a>
              ))}
            </div>
          </Section>
        )}

        <FcraFooter />
      </main>
    </div>
  );
}
