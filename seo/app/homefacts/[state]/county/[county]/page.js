// HomeFacts COUNTY area profile — /homefacts/{state}/county/{county}, e.g. /homefacts/tx/county/travis.
// One of the four area-profile grains (city · county · zip · address). Built on the all-US county backbone
// (data/counties.json from FEMA NRI) so it works for every county, independent of the incarceration roster.
// Live without any key: FEMA natural-disaster risk + first-party sex-offender registry. ACS demographics /
// property attach via fetch-at-generation when CENSUS_API_KEY is set (ISR-cached), else the section is omitted.
import { notFound } from 'next/navigation';
import { getStateSlice } from '../../../../../lib/directory';
import { countyFromSlug, hfCountyPath, hfStatePath, getCountyAcs, demographicStats, propertyStats, femaRatingColor } from '../../../../../lib/homefacts';
import { crumbsJsonLd } from '../../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../../lib/ui';
import { SITE, MAIN } from '../../../../../lib/site';
import { querySexOffenders } from '../../../../../lib/sexOffenderDb.mjs';
import { SexOffenderSection } from '../../../../../lib/sex-offender-section';

export const revalidate = 5184000; // 60d ISR
export function generateStaticParams() { return []; }

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const withTimeout = (p, fb, ms = 1200) => Promise.race([p.catch(() => fb), new Promise((r) => setTimeout(() => r(fb), ms))]);

const snap = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, margin: '4px 0' },
  cell: { background: ui.color.soft, border: `1px solid ${ui.color.softBorder}`, borderRadius: 8, padding: '12px 14px' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: ui.color.muted, fontWeight: 800 },
  value: { fontSize: 20, fontWeight: 800, color: ui.color.accent, marginTop: 2 },
};
function StatGrid({ stats }) {
  return <div style={snap.grid}>{stats.map((s) => <div key={s.label} style={snap.cell}><div style={snap.label}>{s.label}</div><div style={snap.value}>{s.value}</div></div>)}</div>;
}

export async function generateMetadata({ params }) {
  const { state, county } = await params;
  const st = getStateSlice(state);
  const c = countyFromSlug(state, county);
  if (!st || !c) return { title: 'Not found', robots: { index: false, follow: true } };
  return {
    title: `${c.name} County, ${st.code} Neighborhood Report — Disaster Risk, Demographics & Sex Offenders | HomeFacts`,
    description: `Area profile for ${c.name} County, ${st.name}: FEMA natural-disaster risk, demographics, property values, and the registered sex-offender registry.`,
    alternates: { canonical: `${SITE}${hfCountyPath(state, c.slug)}` },
  };
}

export default async function CountyProfile({ params }) {
  const { state, county } = await params;
  const st = getStateSlice(state);
  const c = countyFromSlug(state, county);
  if (!st || !c) notFound();

  const [offenders, acs] = await Promise.all([
    withTimeout(querySexOffenders({ state: st.code, county: c.name, limit: 16 }), []),
    withTimeout(getCountyAcs(c.fips), null, 6500),
  ]);
  const demo = demographicStats(acs);
  const prop = propertyStats(acs);

  const crumbs = [
    { name: 'HomeFacts', path: '/homefacts' },
    { name: st.name, path: hfStatePath(state) },
    { name: `${c.name} County`, path: hfCountyPath(state, c.slug) },
  ];
  const jump = [
    demo.length > 0 && ['summary', 'Overview'], demo.length > 0 && ['demographics', 'Demographics'],
    prop.length > 0 && ['property', 'Property'], ['disasters', 'Natural disasters'], ['offenders', 'Sex offenders'],
  ].filter(Boolean);

  return (
    <main style={ui.main}>
      <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
      <Breadcrumbs crumbs={crumbs} />

      <section style={ui.hero}>
        <p style={ui.eyebrow}>County neighborhood report</p>
        <h1 style={ui.h1}>{c.name} County, {st.code}</h1>
        {c.rating && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 0', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: ui.color.body }}>FEMA overall disaster risk:</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', background: femaRatingColor(c.rating), borderRadius: 999, padding: '4px 12px' }}>{c.rating}</span>
          </div>
        )}
        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {jump.map(([id, label]) => (
            <a key={id} href={`#${id}`} style={{ fontSize: 13, fontWeight: 700, color: ui.color.body, background: ui.color.soft, border: `1px solid ${ui.color.softBorder}`, borderRadius: 999, padding: '6px 12px', textDecoration: 'none' }}>{label}</a>
          ))}
        </nav>
      </section>

      {demo.length > 0 && (
        <section id="demographics" style={ui.card}>
          <h2 style={ui.h2}>Demographics</h2>
          <StatGrid stats={demo} />
          <p style={ui.source}>County-level. Source: U.S. Census Bureau, American Community Survey (5-year).</p>
        </section>
      )}
      {prop.length > 0 && (
        <section id="property" style={ui.card}>
          <h2 style={ui.h2}>Property report</h2>
          <StatGrid stats={prop} />
          <p style={ui.source}>County-level. Source: U.S. Census Bureau, ACS (5-year).</p>
        </section>
      )}

      <section id="disasters" style={ui.card}>
        <h2 style={ui.h2}>Natural disaster risk</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 12px' }}>
          <span style={{ fontSize: 13, color: ui.color.body }}>Overall risk for {c.name} County:</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', background: femaRatingColor(c.rating), borderRadius: 999, padding: '4px 12px' }}>{c.rating || 'Not rated'}</span>
        </div>
        {c.hazards && c.hazards.length > 0 && (
          <>
            <div style={{ ...snap.label, marginBottom: 4 }}>Top hazards</div>
            {c.hazards.map((h) => (
              <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0', fontSize: 13 }}>
                <span style={{ width: 150, color: ui.color.body }}>{h.label}</span>
                <span style={{ flex: 1, height: 8, background: '#eef2f0', borderRadius: 999, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${(h.sev / 5) * 100}%`, background: femaRatingColor(h.rating) }} /></span>
                <span style={{ width: 120, textAlign: 'right', color: femaRatingColor(h.rating), fontWeight: 700, fontSize: 12 }}>{h.rating}</span>
              </div>
            ))}
          </>
        )}
        <p style={ui.source}>County-level natural-hazard risk. Source: FEMA National Risk Index.</p>
      </section>

      <div id="offenders">
        <SexOffenderSection
          records={offenders}
          heading={`Registered sex offenders in ${c.name} County, ${st.code} (${offenders.length})`}
          blurb={`Public sex-offender registry records for ${c.name} County, ${st.name}.`}
        />
      </div>

      <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=homefacts&state=${st.code}`} style={ui.secondaryCta}>
        Look up a person in {c.name} County →
      </a>
      <FcraFooter />
    </main>
  );
}
