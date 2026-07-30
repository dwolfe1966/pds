// HomeFacts COUNTY area profile — /homefacts/{state}/county/{county}. All-US via data/counties.json (FEMA NRI).
// Live without a key: FEMA disaster risk + sex-offender registry; ACS demographics/property attach when
// CENSUS_API_KEY is set (fetch-at-generation, ISR-cached). Design: lib/hf.js.
import { notFound } from 'next/navigation';
import { getStateSlice } from '../../../../../lib/directory';
import { countyFromSlug, hfCountyPath, hfStatePath, hfCityPath, getCountyAcs, demographicStats, propertyStats, femaRatingColor, citiesInCounty } from '../../../../../lib/homefacts';
import { hf, hfColor, HfHeader, HfBreadcrumbs, SummaryBand, SectionNav, Section, StatGrid, Bar, TopoMotif } from '../../../../../lib/hf';
import { HfIcon } from '../../../../../lib/HfIcon';
import { crumbsJsonLd } from '../../../../../lib/schema';
import { FcraFooter, JsonLd } from '../../../../../lib/ui';
import { SITE, MAIN } from '../../../../../lib/site';
import { querySexOffenders } from '../../../../../lib/sexOffenderDb.mjs';
import { SexOffenderSection } from '../../../../../lib/sex-offender-section';
import { rosterTopNamesByCounty } from '../../../../../lib/incarceration.mjs';
import OffenderMap from '../../../OffenderMap';

export const revalidate = 5184000; // 60d ISR
export function generateStaticParams() { return []; }

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const money = (n) => (n == null ? null : '$' + Number(n).toLocaleString('en-US'));
const withTimeout = (p, fb, ms = 1200) => Promise.race([p.catch(() => fb), new Promise((r) => setTimeout(() => r(fb), ms))]);

export async function generateMetadata({ params }) {
  const { state, county } = await params;
  const st = getStateSlice(state);
  const c = countyFromSlug(state, county);
  if (!st || !c) return { title: 'Not found', robots: { index: false, follow: true } };
  return {
    title: `${c.name} County, ${st.code} Neighborhood Report — Disaster Risk, Demographics & Sex Offenders | Homefacts`,
    description: `Area profile for ${c.name} County, ${st.name}: FEMA natural-disaster risk, demographics, property values, and the registered sex-offender registry.`,
    alternates: { canonical: `${SITE}${hfCountyPath(state, c.slug)}` },
  };
}

export default async function CountyProfile({ params }) {
  const { state, county } = await params;
  const st = getStateSlice(state);
  const c = countyFromSlug(state, county);
  if (!st || !c) notFound();

  const [offenders, acs, inmateNames] = await Promise.all([
    withTimeout(querySexOffenders({ state: st.code, county: c.name, limit: 16 }), []),
    withTimeout(getCountyAcs(c.fips), null, 6500),
    withTimeout(rosterTopNamesByCounty({ state: st.code, county: c.slug, limit: 30 }), [], 5000),
  ]);
  const demo = demographicStats(acs);
  const prop = propertyStats(acs);
  const cities = citiesInCounty(state, c.name);

  const summary = [
    acs?.population != null && { label: 'Population', value: num(acs.population), icon: 'demographics' },
    acs?.medianHomeValue != null && { label: 'Median home', value: money(acs.medianHomeValue), icon: 'property' },
    c.rating && { label: 'Disaster risk', value: c.rating, tone: femaRatingColor(c.rating), icon: 'disasters' },
    { label: 'Sex offenders', value: num(offenders.length), icon: 'offenders' },
  ].filter(Boolean);

  const crumbs = [
    { name: 'Homefacts', path: '/homefacts' },
    { name: st.name, path: hfStatePath(state) },
    { name: `${c.name} County`, path: hfCountyPath(state, c.slug) },
  ];
  const nav = [
    demo.length > 0 && { id: 'demographics', label: 'Demographics' },
    prop.length > 0 && { id: 'property', label: 'Property' },
    { id: 'disasters', label: 'Natural disasters' },
    inmateNames.length > 0 && { id: 'incarceration', label: 'Incarceration records' },
    { id: 'offenders', label: 'Sex offenders' },
  ].filter(Boolean);

  return (
    <div style={hf.page}>
      <HfHeader />
      <main style={hf.main}>
        <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
        <HfBreadcrumbs crumbs={crumbs} />

        <section style={{ ...hf.card, marginBottom: 8, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${hfColor.accentSoft} 0%, ${hfColor.surface} 62%)` }}>
          <TopoMotif color={hfColor.accent} opacity={0.06} />
          <div style={{ position: 'relative' }}>
            <p style={{ ...hf.eyebrow, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <HfIcon name="neighborhood" size={14} color={hfColor.accent} /> County neighborhood report
            </p>
            <h1 style={hf.h1}>{c.name} County, {st.code}</h1>
            <SummaryBand items={summary} />
          </div>
        </section>

        <SectionNav items={nav} />

        {demo.length > 0 && (
          <Section id="demographics" eyebrow="Who lives here" title="Demographics" source="County-level. Source: U.S. Census Bureau, American Community Survey (5-year).">
            <StatGrid stats={demo} />
          </Section>
        )}
        {prop.length > 0 && (
          <Section id="property" eyebrow="Housing" title="Property report" source="County-level. Source: U.S. Census Bureau, ACS (5-year).">
            <StatGrid stats={prop} />
          </Section>
        )}

        <Section id="disasters" eyebrow="Risk" title="Natural disaster risk"
          right={<span style={{ fontSize: 13, fontWeight: 800, color: '#fff', background: femaRatingColor(c.rating), borderRadius: 999, padding: '5px 13px', whiteSpace: 'nowrap' }}>{c.rating || 'Not rated'}</span>}
          source="County-level natural-hazard risk. Source: FEMA National Risk Index.">
          {c.hazards && c.hazards.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: hfColor.muted, marginBottom: 6 }}>Top hazards</div>
              {c.hazards.map((h) => <Bar key={h.label} label={h.label} pct={(h.sev / 5) * 100} color={femaRatingColor(h.rating)} right={h.rating} />)}
            </>
          )}
        </Section>

        {inmateNames.length > 0 && (
          <Section id="incarceration" eyebrow="Public records" title="Incarceration records"
            source="Names with the most public booking/incarceration records in the county. Source: state & county correctional rosters (first-party).">
            <div style={hf.linkGrid}>
              {inmateNames.slice(0, 30).map((n) => (
                <a key={n.slug} href={`/people/${st.code.toLowerCase()}/county/${c.slug}/${n.slug}`} style={{ ...hf.link, fontSize: 14 }}>
                  {n.name}{n.count ? <span style={{ color: hfColor.muted }}> ({num(n.count)})</span> : null}
                </a>
              ))}
            </div>
          </Section>
        )}

        <div id="offenders" style={hf.card}>
          {offenders.some((o) => Number.isFinite(o.latitude) && Number.isFinite(o.longitude)) && (
            <div style={{ marginBottom: 16 }}>
              <OffenderMap
                points={offenders.map((o) => ({ lat: o.latitude, lng: o.longitude, label: o.name || 'Registered offender', sub: [o.city, o.absconder ? 'ABSCONDER' : null].filter(Boolean).join(' · ') }))}
                height={340}
              />
            </div>
          )}
          <SexOffenderSection records={offenders} heading={`Registered sex offenders in ${c.name} County, ${st.code} (${offenders.length})`} blurb={`Public sex-offender registry records for ${c.name} County, ${st.name}.`} />
        </div>

        {cities.length > 0 && (
          <Section id="cities" eyebrow="Browse" title={`Cities in ${c.name} County`}>
            <div style={hf.linkGrid}>
              {cities.map((ct) => (
                <a key={ct.slug} href={hfCityPath(state, ct.slug)} style={{ ...hf.link, fontSize: 14 }}>{ct.city}</a>
              ))}
            </div>
          </Section>
        )}

        <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=homefacts&state=${st.code}`} style={hf.secondaryCta}>Look up a person in {c.name} County →</a>
        <FcraFooter />
      </main>
    </div>
  );
}
