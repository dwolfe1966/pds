// HomeFacts ZIP area profile — /homefacts/zip/{zip}. REAL ZIP-level (ZCTA) demographics + property from ACS
// (fetch-at-generation, ISR-cached) + county FEMA disaster risk + sex-offender registry scoped to the ZIP.
// Place/state/county resolved at generation via Zippopotam + FCC. Design: lib/hf.js.
import { notFound } from 'next/navigation';
import { getZctaAcs, getCountyByFips, demographicStats, propertyStats, femaRatingColor, hfCityPath, hfCountyPath, hfStatePath } from '../../../../lib/homefacts';
import { stateName } from '../../../../lib/states';
import { hf, hfColor, HfHeader, HfBreadcrumbs, SummaryBand, SectionNav, Section, StatGrid, Bar } from '../../../../lib/hf';
import { crumbsJsonLd } from '../../../../lib/schema';
import { FcraFooter, JsonLd } from '../../../../lib/ui';
import { SITE, MAIN } from '../../../../lib/site';
import { querySexOffenders } from '../../../../lib/sexOffenderDb.mjs';
import { SexOffenderSection } from '../../../../lib/sex-offender-section';

export const revalidate = 5184000; // 60d ISR
export function generateStaticParams() { return []; }

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const money = (n) => (n == null ? null : '$' + Number(n).toLocaleString('en-US'));
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const t = (p, fb, ms) => Promise.race([p.catch(() => fb), new Promise((r) => setTimeout(() => r(fb), ms))]);

async function geoForZip(zip) {
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(6000), next: { revalidate: 5184000 } });
    if (!r.ok) return null;
    const d = await r.json(); const p = d.places && d.places[0];
    return p ? { place: p['place name'], stateAbbr: String(p['state abbreviation']).toUpperCase(), lat: +p.latitude, lng: +p.longitude } : null;
  } catch { return null; }
}
async function countyFipsFor(lat, lng) {
  try {
    const r = await fetch(`https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&format=json`, { signal: AbortSignal.timeout(6000), next: { revalidate: 5184000 } });
    if (!r.ok) return null;
    const d = await r.json(); return d.County && d.County.FIPS ? String(d.County.FIPS) : null;
  } catch { return null; }
}
async function resolve(zip) {
  const [acs, geo] = await Promise.all([t(getZctaAcs(zip), null, 6500), t(geoForZip(zip), null, 6500)]);
  let fema = null, offenders = [];
  if (geo) {
    const [fips, offs] = await Promise.all([t(countyFipsFor(geo.lat, geo.lng), null, 6500), t(querySexOffenders({ state: geo.stateAbbr, zip, limit: 16 }), [])]);
    fema = fips ? getCountyByFips(fips) : null; offenders = offs;
  }
  return { acs, geo, fema, offenders };
}

export async function generateMetadata({ params }) {
  const { zip } = await params;
  if (!/^\d{5}$/.test(zip)) return { title: 'Not found', robots: { index: false, follow: true } };
  const geo = await t(geoForZip(zip), null, 6500);
  const where = geo ? `${geo.place}, ${geo.stateAbbr}` : 'the U.S.';
  return {
    title: `ZIP ${zip}${geo ? ` (${geo.place}, ${geo.stateAbbr})` : ''} Neighborhood Report — Demographics, Property & Disaster Risk | Homefacts`,
    description: `Area profile for ZIP code ${zip} in ${where}: demographics, home values and rents, natural-disaster risk, and the registered sex-offender registry.`,
    alternates: { canonical: `${SITE}/homefacts/zip/${zip}` },
  };
}

export default async function ZipProfile({ params }) {
  const { zip } = await params;
  if (!/^\d{5}$/.test(zip)) notFound();
  const { acs, geo, fema, offenders } = await resolve(zip);
  if (!acs && !geo) notFound();

  const demo = demographicStats(acs);
  const prop = propertyStats(acs);
  const stName = geo ? stateName(geo.stateAbbr) : null;
  const stLc = geo ? geo.stateAbbr.toLowerCase() : null;

  const summary = [
    acs?.population != null && { label: 'Population', value: num(acs.population) },
    acs?.medianHomeValue != null && { label: 'Median home', value: money(acs.medianHomeValue) },
    fema?.rating && { label: 'Disaster risk', value: fema.rating, tone: femaRatingColor(fema.rating) },
    { label: 'Sex offenders', value: num(offenders.length) },
  ].filter(Boolean);

  const crumbs = [
    { name: 'Homefacts', path: '/homefacts' },
    ...(stName ? [{ name: stName, path: hfStatePath(stLc) }] : []),
    { name: `ZIP ${zip}`, path: `/homefacts/zip/${zip}` },
  ];
  const nav = [demo.length > 0 && { id: 'demographics', label: 'Demographics' }, prop.length > 0 && { id: 'property', label: 'Property' }, fema && { id: 'disasters', label: 'Natural disasters' }, { id: 'offenders', label: 'Sex offenders' }].filter(Boolean);

  return (
    <div style={hf.page}>
      <HfHeader />
      <main style={hf.main}>
        <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
        <HfBreadcrumbs crumbs={crumbs} />

        <section style={{ ...hf.card, marginBottom: 8 }}>
          <p style={hf.eyebrow}>ZIP code neighborhood report</p>
          <h1 style={hf.h1}>ZIP {zip}{geo ? ` — ${geo.place}, ${geo.stateAbbr}` : ''}</h1>
          {geo && (
            <p style={{ ...hf.lead, fontSize: 15 }}>
              Covers part of <a href={hfCityPath(stLc, slugify(geo.place))} style={hf.link}>{geo.place}</a>
              {fema ? <> in <a href={hfCountyPath(stLc, fema.slug)} style={hf.link}>{fema.name} County</a></> : null}, {geo.stateAbbr}.
            </p>
          )}
          <SummaryBand items={summary} />
        </section>

        <SectionNav items={nav} />

        {demo.length > 0 && (
          <Section id="demographics" eyebrow="Who lives here" title="Demographics" source="ZIP-level (ZCTA). Source: U.S. Census Bureau, American Community Survey (5-year).">
            <StatGrid stats={demo} />
          </Section>
        )}
        {prop.length > 0 && (
          <Section id="property" eyebrow="Housing" title="Property report" source="ZIP-level (ZCTA). Source: U.S. Census Bureau, ACS (5-year).">
            <StatGrid stats={prop} />
          </Section>
        )}
        {demo.length === 0 && prop.length === 0 && (
          <Section id="demographics" eyebrow="Who lives here" title="Demographics &amp; property">
            <p style={{ margin: 0, fontSize: 14, color: hfColor.body }}>ZIP-level Census data for {zip} is being loaded. Source: U.S. Census Bureau, ACS (ZCTA).</p>
          </Section>
        )}

        {fema && (
          <Section id="disasters" eyebrow="Risk" title="Natural disaster risk"
            right={<span style={{ fontSize: 13, fontWeight: 800, color: '#fff', background: femaRatingColor(fema.rating), borderRadius: 999, padding: '5px 13px', whiteSpace: 'nowrap' }}>{fema.rating || 'Not rated'}</span>}
            source={`County-level natural-hazard risk for the county covering ZIP ${zip}. Source: FEMA National Risk Index.`}>
            {fema.hazards && fema.hazards.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: hfColor.muted, marginBottom: 6 }}>Top hazards · {fema.name} County</div>
                {fema.hazards.map((h) => <Bar key={h.label} label={h.label} pct={(h.sev / 5) * 100} color={femaRatingColor(h.rating)} right={h.rating} />)}
              </>
            )}
          </Section>
        )}

        <div id="offenders" style={hf.card}>
          <SexOffenderSection records={offenders} heading={`Registered sex offenders in ZIP ${zip} (${offenders.length})`} blurb={`Public sex-offender registry records for ZIP code ${zip}.`} />
        </div>

        <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=homefacts${stLc ? `&state=${geo.stateAbbr}` : ''}`} style={hf.secondaryCta}>Look up a person in ZIP {zip} →</a>
        <FcraFooter />
      </main>
    </div>
  );
}
