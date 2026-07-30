// HomeFacts ZIP area profile — /homefacts/zip/{zip}, e.g. /homefacts/zip/78701. The ZIP grain of the
// city·county·zip·address model. REAL ZIP-level demographics + property from ACS (ZCTA, fetch-at-generation,
// ISR-cached), county-level FEMA disaster risk, and the sex-offender registry scoped to the ZIP (first-party
// Neon). Place/state/county are resolved at generation via Zippopotam (zip→lat/lng) + FCC (lat/lng→county).
import { notFound } from 'next/navigation';
import { getZctaAcs, getCountyByFips, demographicStats, propertyStats, femaRatingColor, hfCityPath, hfCountyPath, hfStatePath } from '../../../../lib/homefacts';
import { stateName } from '../../../../lib/states';
import { crumbsJsonLd } from '../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../lib/ui';
import { SITE, MAIN } from '../../../../lib/site';
import { querySexOffenders } from '../../../../lib/sexOffenderDb.mjs';
import { SexOffenderSection } from '../../../../lib/sex-offender-section';

export const revalidate = 5184000; // 60d ISR
export function generateStaticParams() { return []; }

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const money = (n) => (n == null ? null : '$' + Number(n).toLocaleString('en-US'));
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const t = (p, fb, ms) => Promise.race([p.catch(() => fb), new Promise((r) => setTimeout(() => r(fb), ms))]);

const snap = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, margin: '4px 0' },
  cell: { background: ui.color.soft, border: `1px solid ${ui.color.softBorder}`, borderRadius: 8, padding: '12px 14px' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: ui.color.muted, fontWeight: 800 },
  value: { fontSize: 20, fontWeight: 800, color: ui.color.accent, marginTop: 2 },
};
const StatGrid = ({ stats }) => <div style={snap.grid}>{stats.map((s) => <div key={s.label} style={snap.cell}><div style={snap.label}>{s.label}</div><div style={snap.value}>{s.value}</div></div>)}</div>;

async function geoForZip(zip) {
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const d = await r.json(); const p = d.places && d.places[0];
    return p ? { place: p['place name'], stateAbbr: String(p['state abbreviation']).toUpperCase(), lat: +p.latitude, lng: +p.longitude } : null;
  } catch { return null; }
}
async function countyFipsFor(lat, lng) {
  try {
    const r = await fetch(`https://geo.fcc.gov/api/census/block/find?latitude=${lat}&longitude=${lng}&format=json`, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const d = await r.json(); return d.County && d.County.FIPS ? String(d.County.FIPS) : null;
  } catch { return null; }
}

async function resolve(zip) {
  const [acs, geo] = await Promise.all([t(getZctaAcs(zip), null, 6500), t(geoForZip(zip), null, 6500)]);
  let fema = null, offenders = [];
  if (geo) {
    const [fips, offs] = await Promise.all([
      t(countyFipsFor(geo.lat, geo.lng), null, 6500),
      t(querySexOffenders({ state: geo.stateAbbr, zip, limit: 16 }), []),
    ]);
    fema = fips ? getCountyByFips(fips) : null;
    offenders = offs;
  }
  return { acs, geo, fema, offenders };
}

export async function generateMetadata({ params }) {
  const { zip } = await params;
  if (!/^\d{5}$/.test(zip)) return { title: 'Not found', robots: { index: false, follow: true } };
  const geo = await t(geoForZip(zip), null, 6500);
  const where = geo ? `${geo.place}, ${geo.stateAbbr}` : 'the U.S.';
  return {
    title: `ZIP ${zip}${geo ? ` (${geo.place}, ${geo.stateAbbr})` : ''} Neighborhood Report — Demographics, Property & Disaster Risk | HomeFacts`,
    description: `Area profile for ZIP code ${zip} in ${where}: demographics, home values and rents, natural-disaster risk, and the registered sex-offender registry.`,
    alternates: { canonical: `${SITE}/homefacts/zip/${zip}` },
  };
}

export default async function ZipProfile({ params }) {
  const { zip } = await params;
  if (!/^\d{5}$/.test(zip)) notFound();
  const { acs, geo, fema, offenders } = await resolve(zip);
  if (!acs && !geo) notFound(); // unresolvable ZIP

  const demo = demographicStats(acs);
  const prop = propertyStats(acs);
  const stName = geo ? stateName(geo.stateAbbr) : null;
  const stLc = geo ? geo.stateAbbr.toLowerCase() : null;

  const crumbs = [
    { name: 'HomeFacts', path: '/homefacts' },
    ...(stName ? [{ name: stName, path: hfStatePath(stLc) }] : []),
    { name: `ZIP ${zip}`, path: `/homefacts/zip/${zip}` },
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
      <Breadcrumbs crumbs={crumbs} />

      <section style={ui.hero}>
        <p style={ui.eyebrow}>ZIP code neighborhood report</p>
        <h1 style={ui.h1}>ZIP {zip}{geo ? ` — ${geo.place}, ${geo.stateAbbr}` : ''}</h1>
        {geo && (
          <p style={{ ...ui.lead, marginTop: 10 }}>
            ZIP code {zip} covers part of <a href={hfCityPath(stLc, slugify(geo.place))} style={ui.link}>{geo.place}</a>
            {fema ? <> in <a href={hfCountyPath(stLc, fema.slug)} style={ui.link}>{fema.name} County</a></> : null}, {geo.stateAbbr}.
          </p>
        )}
      </section>

      {(demo.length > 0 || prop.length > 0) ? (
        <>
          {demo.length > 0 && (
            <section style={ui.card}>
              <h2 style={ui.h2}>Demographics</h2>
              <StatGrid stats={demo} />
              <p style={ui.source}>ZIP-level (ZCTA). Source: U.S. Census Bureau, American Community Survey (5-year).</p>
            </section>
          )}
          {prop.length > 0 && (
            <section style={ui.card}>
              <h2 style={ui.h2}>Property report</h2>
              <StatGrid stats={prop} />
              <p style={ui.source}>ZIP-level (ZCTA). Source: U.S. Census Bureau, ACS (5-year).</p>
            </section>
          )}
        </>
      ) : (
        <section style={ui.card}>
          <h2 style={ui.h2}>Demographics &amp; property</h2>
          <p style={{ margin: 0, fontSize: 14, color: ui.color.body }}>ZIP-level Census data for {zip} is being loaded. Source: U.S. Census Bureau, ACS (ZCTA).</p>
        </section>
      )}

      {fema && (
        <section style={ui.card}>
          <h2 style={ui.h2}>Natural disaster risk</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 12px' }}>
            <span style={{ fontSize: 13, color: ui.color.body }}>Overall risk for {fema.name} County:</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', background: femaRatingColor(fema.rating), borderRadius: 999, padding: '4px 12px' }}>{fema.rating || 'Not rated'}</span>
          </div>
          {fema.hazards && fema.hazards.map((h) => (
            <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0', fontSize: 13 }}>
              <span style={{ width: 150, color: ui.color.body }}>{h.label}</span>
              <span style={{ flex: 1, height: 8, background: '#eef2f0', borderRadius: 999, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${(h.sev / 5) * 100}%`, background: femaRatingColor(h.rating) }} /></span>
              <span style={{ width: 120, textAlign: 'right', color: femaRatingColor(h.rating), fontWeight: 700, fontSize: 12 }}>{h.rating}</span>
            </div>
          ))}
          <p style={ui.source}>County-level natural-hazard risk for the county covering ZIP {zip}. Source: FEMA National Risk Index.</p>
        </section>
      )}

      <SexOffenderSection
        records={offenders}
        heading={`Registered sex offenders in ZIP ${zip} (${offenders.length})`}
        blurb={`Public sex-offender registry records for ZIP code ${zip}.`}
      />

      <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=homefacts${stLc ? `&state=${geo.stateAbbr}` : ''}`} style={ui.secondaryCta}>
        Look up a person in ZIP {zip} →
      </a>
      <FcraFooter />
    </main>
  );
}
