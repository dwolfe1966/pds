// HomeFacts CITY area profile — /homefacts/{state}/{city}. Flagship of the four-grain area-profile model.
// Nine modules on real public + first-party data; the pending ones name their source (no fabrication).
// Design system: lib/hf.js (Homefacts blue + report-card summary + sticky section nav).
import { notFound } from 'next/navigation';
import { getCitySlice, getStateCities, getNearbyCities } from '../../../../lib/directory';
import {
  getCityAcs, getCityWiki, getCityPeople, getCityHistoric, getCityNewspapers, getPopHistory,
  cityWikiChips, cityEthnicity, cityOccupations, cityProse,
} from '../../../../lib/facts';
import {
  propertyStats, demographicStats, HF_MODULES, hfCityPath, hfStatePath, hfCountyPath,
  getCityFema, femaRatingColor, getCitySchools, getCityEpa, countyForName,
} from '../../../../lib/homefacts';
import { hf, hfColor, HfHeader, HfBreadcrumbs, SummaryBand, SectionNav, Section, StatGrid, Bar } from '../../../../lib/hf';
import { StateMap } from '../../../../lib/statemap';
import { PopChart } from '../../../../lib/popchart';
import { crumbsJsonLd } from '../../../../lib/schema';
import { FcraFooter, JsonLd } from '../../../../lib/ui';
import { SITE, MAIN } from '../../../../lib/site';
import { querySexOffenders } from '../../../../lib/sexOffenderDb.mjs';
import { SexOffenderSection } from '../../../../lib/sex-offender-section';
import FromBanner from './FromBanner';

export const revalidate = 5184000; // 60d ISR
export function generateStaticParams() { return []; }

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const money = (n) => (n == null ? null : '$' + Number(n).toLocaleString('en-US'));
const withTimeout = (p, fb, ms = 1200) => Promise.race([p.catch(() => fb), new Promise((r) => setTimeout(() => r(fb), ms))]);

function Pending({ id, eyebrow, title, source, blurb }) {
  return (
    <Section id={id} eyebrow={eyebrow} title={title} source={`Data source being added: ${source}. We show real, sourced figures only — never estimates.`}>
      <p style={{ margin: 0, fontSize: 14, color: hfColor.body, lineHeight: 1.65 }}>{blurb}</p>
    </Section>
  );
}

export async function generateMetadata({ params }) {
  const { state, city } = await params;
  const c = getCitySlice(state, city);
  if (!c) return {};
  return {
    title: `${c.city}, ${c.stateCode} Neighborhood Report — Demographics, Property, Schools, Crime & Sex Offenders | Homefacts`,
    description: `Area profile for ${c.city}, ${c.stateName}: demographics, home values and rents, schools, natural-disaster risk, environmental hazards, neighborhood info, and the registered sex-offender registry.`,
    alternates: { canonical: `${SITE}${hfCityPath(state, city)}` },
  };
}

export default async function AreaProfile({ params }) {
  const { state, city } = await params;
  const c = getCitySlice(state, city);
  if (!c) notFound();

  const acs = getCityAcs(c.stateCode, city);
  const wiki = getCityWiki(c.stateCode, city);
  const offenders = await withTimeout(querySexOffenders({ state: c.stateCode, city: c.city, limit: 16 }), []);
  const chips = cityWikiChips(wiki);
  const eth = cityEthnicity(acs);
  const occupations = cityOccupations(acs);
  const prose = cityProse(c.city, c.stateName, acs, city, wiki);
  const demo = demographicStats(acs);
  const prop = propertyStats(acs);
  const people = getCityPeople(c.stateCode, city);
  const historic = getCityHistoric(c.stateCode, city);
  const newspapers = getCityNewspapers(c.stateCode, city);
  const popPoints = getPopHistory(c.stateCode, city, acs?.population);
  const nearby = getNearbyCities(state, city, 6);
  const stateCities = getStateCities(state);
  const fema = getCityFema(c.stateCode, city);
  const schools = getCitySchools(c.stateCode, city);
  const epa = getCityEpa(c.stateCode, city);
  const county = countyForName(state, (fema && fema.county) || (wiki && wiki.county));

  // Report-card summary — the scannable headline metrics.
  const summary = [
    acs?.population != null && { label: 'Population', value: num(acs.population) },
    acs?.medianHomeValue != null && { label: 'Median home', value: money(acs.medianHomeValue) },
    fema?.rating && { label: 'Disaster risk', value: fema.rating, tone: femaRatingColor(fema.rating) },
    schools?.count != null && { label: 'Public schools', value: num(schools.count) },
    { label: 'Sex offenders', value: num(offenders.length) },
  ].filter(Boolean);

  const crumbs = [
    { name: 'Homefacts', path: '/homefacts' },
    { name: c.stateName, path: hfStatePath(state) },
    { name: c.city, path: hfCityPath(state, city) },
  ];
  const navItems = HF_MODULES.map((m) => ({ id: m.id, label: m.label }));

  return (
    <div style={hf.page}>
      <HfHeader />
      <main style={hf.main}>
        <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
        <HfBreadcrumbs crumbs={crumbs} />
        <FromBanner city={c.city} stateCode={c.stateCode} />

        <section style={{ ...hf.card, marginBottom: 8 }}>
          <p style={hf.eyebrow}>Neighborhood report</p>
          <h1 style={hf.h1}>{c.city}, {c.stateCode}</h1>
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {chips.map((ch) => <span key={ch} style={hf.chip}>{ch}</span>)}
            </div>
          )}
          <SummaryBand items={summary} />
        </section>

        <SectionNav items={navItems} />

        {/* 1 · Overview */}
        {prose && (
          <Section id="summary" eyebrow="Overview" title={`About ${c.city}`} source="Source: U.S. Census Bureau, American Community Survey (5-year).">
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: hfColor.body }}>{prose}</p>
          </Section>
        )}

        {/* 2 · Demographics */}
        {demo.length > 0 && (
          <Section id="demographics" eyebrow="Who lives here" title="Demographics" source="Source: U.S. Census Bureau, American Community Survey (5-year).">
            <StatGrid stats={demo} />
            {eth.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: hfColor.muted, marginBottom: 6 }}>Residents by race &amp; ethnicity</div>
                {eth.map((e) => <Bar key={e.label} label={e.label} pct={e.value} right={`${e.value}%`} />)}
              </div>
            )}
            {occupations.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: hfColor.muted, marginBottom: 6 }}>Workforce by occupation</div>
                {occupations.map((o) => <Bar key={o.label} label={o.label} pct={o.value} right={`${o.value}%`} />)}
              </div>
            )}
          </Section>
        )}

        {/* 3 · Property */}
        {prop.length > 0 && (
          <Section id="property" eyebrow="Housing" title="Property report" source="Area-level figures. Source: U.S. Census Bureau, ACS (5-year). Parcel-level records coming next.">
            <StatGrid stats={prop} />
          </Section>
        )}

        {/* 4 · Schools */}
        {schools ? (
          <Section id="schools" eyebrow="Education" title="Schools" source="Public schools. Source: U.S. Dept. of Education, NCES Common Core of Data (via Urban Institute).">
            <p style={{ margin: '0 0 14px', fontSize: 15, color: hfColor.body, lineHeight: 1.6 }}>
              {c.city} has <strong>{num(schools.count)}</strong> public school{schools.count === 1 ? '' : 's'}
              {(() => { const parts = ['Elementary', 'Middle', 'High'].map((k) => schools.byLevel[k] ? `${num(schools.byLevel[k])} ${k.toLowerCase()}` : null).filter(Boolean); return parts.length ? <> — {parts.join(', ')}</> : null; })()}.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {schools.sample.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 14, color: hfColor.body }}>
                  <span style={{ fontWeight: 600 }}>{s.name}</span>
                  {s.level && <span style={{ ...hf.chip, fontSize: 11, padding: '1px 8px' }}>{s.level}</span>}
                  {s.lo && s.hi && <span style={{ color: hfColor.muted }}>Grades {s.lo}–{s.hi}</span>}
                  {s.charter && <span style={{ fontSize: 11, color: hfColor.accent }}>charter</span>}
                  {s.magnet && <span style={{ fontSize: 11, color: hfColor.accent }}>magnet</span>}
                </div>
              ))}
            </div>
          </Section>
        ) : (
          <Pending id="schools" eyebrow="Education" title="Schools" source="U.S. Dept. of Education / NCES (public)" blurb={`Public, private and charter schools serving ${c.city}.`} />
        )}

        {/* 5 · Crime */}
        <Pending id="crime" eyebrow="Safety" title="Crime" source="FBI Crime Data Explorer + local agencies (public)" blurb={`Violent and property crime rates for ${c.city} and how they compare to ${c.stateName} and national averages.`} />

        {/* 6 · Environment */}
        {epa && epa.count > 0 ? (
          <Section id="environment" eyebrow="Environment" title="Environmental hazards" source="Facilities reporting to the EPA Toxics Release Inventory. Source: U.S. EPA Envirofacts (TRI).">
            <p style={{ margin: '0 0 12px', fontSize: 15, color: hfColor.body, lineHeight: 1.6 }}>
              <strong>{num(epa.count)}</strong> {epa.count === 1 ? 'facility' : 'facilities'} in {c.city} report releasing toxic chemicals to the EPA under the Toxics Release Inventory (TRI).
            </p>
            <div style={hf.linkGrid}>
              {epa.sample.map((f, i) => (
                <span key={i} style={{ fontSize: 14, color: hfColor.body }}>{f.name}{f.county ? <span style={{ color: hfColor.muted }}> · {f.county} County</span> : null}</span>
              ))}
            </div>
          </Section>
        ) : (
          <Pending id="environment" eyebrow="Environment" title="Environmental hazards" source="U.S. EPA — Toxics Release Inventory (public)" blurb={`Toxic-release sites and regulated facilities in and around ${c.city}.`} />
        )}

        {/* 7 · Natural disasters */}
        {fema ? (
          <Section id="disasters" eyebrow="Risk" title="Natural disaster risk"
            right={fema.rating ? <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', background: femaRatingColor(fema.rating), borderRadius: 999, padding: '5px 13px', whiteSpace: 'nowrap' }}>{fema.rating}</span> : null}
            source="County-level natural-hazard risk. Source: FEMA National Risk Index.">
            {fema.hazards && fema.hazards.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: hfColor.muted, marginBottom: 6 }}>Top hazards{fema.county ? ` · ${fema.county} County` : ''}</div>
                {fema.hazards.map((h) => <Bar key={h.label} label={h.label} pct={(h.sev / 5) * 100} color={femaRatingColor(h.rating)} right={h.rating} />)}
              </>
            )}
          </Section>
        ) : (
          <Pending id="disasters" eyebrow="Risk" title="Natural disaster risk" source="FEMA National Risk Index (public)" blurb={`Flood, wildfire, tornado, earthquake and other hazard risk for ${c.city}'s county.`} />
        )}

        {/* 8 · Neighborhood info */}
        <Section id="neighborhood" eyebrow="Context" title="Neighborhood info">
          {county && (
            <p style={{ margin: '0 0 14px', fontSize: 15, color: hfColor.body }}>
              {c.city} is in <a href={hfCountyPath(state, county.slug)} style={hf.link}>{county.name} County</a> — see county-wide risk, demographics, and registry.
            </p>
          )}
          {wiki && (wiki.founded || wiki.county || wiki.elevationM != null || wiki.nickname) && (
            <p style={{ margin: '0 0 14px', fontSize: 14, color: hfColor.body, lineHeight: 1.65 }}>
              {c.city}{wiki.founded ? ` was founded in ${wiki.founded}` : ''}{wiki.county ? `${wiki.founded ? ' and' : ''} sits in ${wiki.county}` : ''}{wiki.nickname ? `, nicknamed “${wiki.nickname}”` : ''}{wiki.elevationM != null ? `. Elevation ~${num(wiki.elevationM)} m` : ''}.
            </p>
          )}
          {popPoints.length >= 4 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: hfColor.muted, marginBottom: 6 }}>Population trend</div>
              <PopChart points={popPoints} width={680} height={220} />
            </div>
          )}
          {stateCities.length >= 3 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: hfColor.muted, marginBottom: 6 }}>Where {c.city} is</div>
              <StateMap cities={stateCities} name={c.stateName} highlight={c.city} width={680} height={360} />
            </div>
          )}
          {historic && historic.count > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: hfColor.muted, marginBottom: 6 }}>Historic places</div>
              <p style={{ margin: '0 0 8px', fontSize: 14, color: hfColor.body }}>{num(historic.count)} on the National Register of Historic Places{historic.nhl > 0 ? `, incl. ${historic.nhl} National Historic Landmark${historic.nhl === 1 ? '' : 's'}` : ''}.</p>
              <div style={hf.linkGrid}>
                {historic.places.slice(0, 12).map((p, i) => (p.url ? <a key={i} href={p.url} target="_blank" rel="noopener" style={{ ...hf.link, fontSize: 14 }}>{p.name}</a> : <span key={i} style={{ fontSize: 14, color: hfColor.body }}>{p.name}</span>))}
              </div>
            </div>
          )}
          {people && people.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: hfColor.muted, marginBottom: 6 }}>Notable people from {c.city}</div>
              <div style={hf.linkGrid}>{people.slice(0, 10).map((p) => <a key={p.url} href={p.url} target="_blank" rel="noopener" style={{ ...hf.link, fontSize: 14 }}>{p.name}</a>)}</div>
            </div>
          )}
          {nearby.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: hfColor.muted, marginBottom: 6 }}>Nearby cities</div>
              <div style={hf.linkGrid}>{nearby.map((n) => <a key={n.slug} href={hfCityPath(state, n.slug)} style={{ ...hf.link, fontSize: 14 }}>{n.city} <span style={{ color: hfColor.muted }}>({num(n.miles)} mi)</span></a>)}</div>
            </div>
          )}
        </Section>

        {/* 9 · Sex offenders */}
        <div id="offenders" style={hf.card}>
          <SexOffenderSection
            records={offenders}
            heading={`Registered sex offenders in ${c.city}, ${c.stateCode} (${offenders.length})`}
            blurb={`Public sex-offender registry records for ${c.city}, ${c.stateName}.`}
          />
        </div>

        <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=homefacts&state=${c.stateCode}`} style={hf.secondaryCta}>
          Look up a person in {c.city} →
        </a>

        <FcraFooter />
      </main>
    </div>
  );
}
