// HomeFacts ZIP area profile — /homefacts/zip/{zip}. REAL ZIP-level (ZCTA) demographics + property from ACS
// (fetch-at-generation, ISR-cached) + county FEMA disaster risk + sex-offender registry scoped to the ZIP.
// Place/state/county resolved at generation via Zippopotam + FCC. Design: lib/hf.js.
import { notFound } from 'next/navigation';
import { getZctaAcs, getCountyByFips, demographicStats, propertyStats, femaRatingColor, hfCityPath, hfCountyPath, hfStatePath, getCitySchools, getCityCrime } from '../../../../lib/homefacts';
import { stateName } from '../../../../lib/states';
import { getCitySlice, getCityTopNames } from '../../../../lib/directory';
import { cityNamePath } from '../../../../lib/ids';
import { rosterTopNamesByCounty } from '../../../../lib/incarceration.mjs';
import { hf, hfColor, HfHeader, HfBreadcrumbs, SummaryBand, SectionNav, Section, StatGrid, Bar } from '../../../../lib/hf';
import { AreaMap } from '../../../../lib/AreaMap';
import OffenderMap from '../../OffenderMap';
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
  let fema = null, offenders = [], city = null, citySlug = null, schools = null, crime = null, names = [], inmateNames = [];
  if (geo) {
    const stLc = geo.stateAbbr.toLowerCase();
    citySlug = slugify(geo.place);
    city = getCitySlice(stLc, citySlug); // the ZIP's city, if we cover it → unlocks city-grain modules
    const [fips, offs, crm] = await Promise.all([
      t(countyFipsFor(geo.lat, geo.lng), null, 6500),
      t(querySexOffenders({ state: geo.stateAbbr, zip, limit: 16 }), []),
      city ? t(getCityCrime(geo.stateAbbr, citySlug), null, 8000) : Promise.resolve(null),
    ]);
    fema = fips ? getCountyByFips(fips) : null; offenders = offs; crime = crm;
    if (city) { schools = getCitySchools(geo.stateAbbr, citySlug); names = getCityTopNames(stLc, citySlug, 24); }
    if (fema) inmateNames = await t(rosterTopNamesByCounty({ state: geo.stateAbbr, county: fema.slug, limit: 24 }), [], 5000);
  }
  return { acs, geo, fema, offenders, city, citySlug, schools, crime, names, inmateNames };
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
  const { acs, geo, fema, offenders, city, citySlug, schools, crime, names, inmateNames } = await resolve(zip);
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
  const nav = [
    demo.length > 0 && { id: 'demographics', label: 'Demographics' },
    prop.length > 0 && { id: 'property', label: 'Property' },
    schools && { id: 'schools', label: 'Schools' },
    crime && (crime.violent || crime.property) && { id: 'crime', label: 'Crime' },
    fema && { id: 'disasters', label: 'Natural disasters' },
    inmateNames.length > 0 && { id: 'incarceration', label: 'Incarceration records' },
    { id: 'offenders', label: 'Sex offenders' },
    names.length > 0 && { id: 'names', label: 'People search' },
  ].filter(Boolean);

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

        {geo && (
          <Section id="map" eyebrow="Location" title={`Map of ZIP ${zip}`}>
            <AreaMap lat={geo.lat} lng={geo.lng} label={`ZIP ${zip}`} zoom={13} height={300} />
          </Section>
        )}

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

        {schools && (
          <Section id="schools" eyebrow="Education" title={`Schools in ${geo.place}`} source="Public schools serving the city. Source: NCES Common Core of Data (via Urban Institute).">
            <p style={{ margin: '0 0 12px', fontSize: 15, color: hfColor.body }}>
              {geo.place} has <strong>{num(schools.count)}</strong> public school{schools.count === 1 ? '' : 's'}
              {(() => { const parts = ['Elementary', 'Middle', 'High'].map((k) => schools.byLevel[k] ? `${num(schools.byLevel[k])} ${k.toLowerCase()}` : null).filter(Boolean); return parts.length ? <> — {parts.join(', ')}</> : null; })()}.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {schools.sample.slice(0, 10).map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 14, color: hfColor.body }}>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  {s.level && <span style={{ ...hf.chip, fontSize: 11, padding: '1px 8px' }}>{s.level}</span>}
                  {s.lo && s.hi && <span style={{ color: hfColor.muted }}>Grades {s.lo}–{s.hi}</span>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {crime && (crime.violent || crime.property) && (
          <Section id="crime" eyebrow="Safety" title={`Crime in ${geo.place}`}
            source={`Rate per 100,000 residents/year, ${crime.agency}, ${crime.year}. Source: FBI UCR/NIBRS (Crime Data Explorer).`}>
            {[crime.violent, crime.property].filter(Boolean).map((row) => {
              const max = Math.max(row.place || 0, row.state || 0, row.us || 0, 1);
              const above = row.us != null && row.place != null && row.place > row.us;
              const placeColor = above ? '#b23a48' : '#2e7d52';
              return (
                <div key={row.kind} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: hfColor.ink, textTransform: 'capitalize', marginBottom: 6 }}>{row.kind} crime</div>
                  <Bar label={geo.place} pct={(row.place / max) * 100} color={placeColor} right={`${num(row.place)}`} />
                  {row.state != null && <Bar label={stName} pct={(row.state / max) * 100} color={hfColor.muted} right={`${num(row.state)}`} />}
                  {row.us != null && <Bar label="United States" pct={(row.us / max) * 100} color={hfColor.faint} right={`${num(row.us)}`} />}
                </div>
              );
            })}
          </Section>
        )}

        {inmateNames.length > 0 && fema && (
          <Section id="incarceration" eyebrow="Public records" title={`Incarceration records — ${fema.name} County`}
            source="Names with the most public booking/incarceration records in the county. Source: state & county correctional rosters (first-party).">
            <div style={hf.linkGrid}>
              {inmateNames.slice(0, 24).map((n) => (
                <a key={n.slug} href={`/people/${stLc}/county/${fema.slug}/${n.slug}`} style={{ ...hf.link, fontSize: 14 }}>
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
                center={geo ? { lat: geo.lat, lng: geo.lng } : null}
                points={offenders.map((o) => ({ lat: o.latitude, lng: o.longitude, label: o.name || 'Registered offender', sub: [o.city, o.absconder ? 'ABSCONDER' : null].filter(Boolean).join(' · ') }))}
                height={320}
              />
            </div>
          )}
          <SexOffenderSection records={offenders} heading={`Registered sex offenders in ZIP ${zip} (${offenders.length})`} blurb={`Public sex-offender registry records for ZIP code ${zip}.`} />
        </div>

        {names.length > 0 && city && (
          <Section id="names" eyebrow="People search" title={`Popular names in ${geo.place}`} source="Common names in the city — search any by age, address, and relatives.">
            <div style={hf.linkGrid}>
              {names.map((n) => (
                <a key={n.slug} href={cityNamePath(geo.stateAbbr, citySlug, n.slug)} style={{ ...hf.link, fontSize: 14 }}>
                  {n.name}{n.estInCity ? <span style={{ color: hfColor.muted }}> ({num(n.estInCity)})</span> : null}
                </a>
              ))}
            </div>
          </Section>
        )}

        <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=homefacts${stLc ? `&state=${geo.stateAbbr}` : ''}`} style={hf.secondaryCta}>Look up a person in ZIP {zip} →</a>
        <FcraFooter />
      </main>
    </div>
  );
}
