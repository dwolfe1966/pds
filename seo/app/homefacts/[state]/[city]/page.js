// HomeFacts CITY area profile — /homefacts/{state}/{city}. Flagship of the four-grain area-profile model.
// Nine modules on real public + first-party data; the pending ones name their source (no fabrication).
// Design system: lib/hf.js (Homefacts blue + report-card summary + sticky section nav).
import { notFound } from 'next/navigation';
import { getCitySlice, getStateCities, getNearbyCities, getCityTopNames, getStateTopNames } from '../../../../lib/directory';
import { cityNamePath } from '../../../../lib/ids';
import { rosterTopNamesByCounty } from '../../../../lib/incarceration.mjs';
import {
  getCityAcs, getCityWiki, getCityPeople, getCityHistoric, getCityNewspapers, getPopHistory,
  cityWikiChips, cityEthnicity, cityOccupations, cityProse,
} from '../../../../lib/facts';
import {
  propertyStats, demographicStats, HF_MODULES, hfCityPath, hfStatePath, hfCountyPath,
  getCityFema, femaRatingColor, getCitySchools, getCityEpa, countyForName, getCityCrime, cityFaqs,
} from '../../../../lib/homefacts';
import { hf, hfColor, HfHeader, HfBreadcrumbs, SummaryBand, SectionNav, Section, StatGrid, Bar, TopoMotif, RiskMeter } from '../../../../lib/hf';
import { HfIcon } from '../../../../lib/HfIcon';
import { StateMap } from '../../../../lib/statemap';
import { AreaMap } from '../../../../lib/AreaMap';
import OffenderMap from '../../OffenderMap';
import NearestToAddress from '../../NearestToAddress';
import AddressSafetySummary from '../../AddressSafetySummary';
import WhatsNearby from '../../WhatsNearby';
import { PopChart } from '../../../../lib/popchart';
import { crumbsJsonLd, faqJsonLd } from '../../../../lib/schema';
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
  const [offenders, crime] = await Promise.all([
    withTimeout(querySexOffenders({ state: c.stateCode, city: c.city, limit: 16 }), []),
    withTimeout(getCityCrime(c.stateCode, city), null, 8000),
  ]);
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
  // Popular names — the place→person bridge (like /people). Links into the /people directory profiles, which
  // lead to people-search. City-native names first, topped up with common state names.
  let names = getCityTopNames(state, city, 40);
  if (names.length < 24) {
    const have = new Set(names.map((n) => n.slug));
    names = names.concat(getStateTopNames(state, 40).filter((n) => !have.has(n.slug)).slice(0, 24 - names.length));
  }
  // Incarceration records carry county, so the city page uses the city's county roster.
  const inmateNames = county ? await withTimeout(rosterTopNamesByCounty({ state: c.stateCode, county: county.slug, limit: 24 }), [], 5000) : [];

  // Report-card summary — the scannable headline metrics, each with its module icon.
  const summary = [
    acs?.population != null && { label: 'Population', value: num(acs.population), icon: 'demographics' },
    acs?.medianHomeValue != null && { label: 'Median home', value: money(acs.medianHomeValue), icon: 'property' },
    fema?.rating && { label: 'Disaster risk', value: fema.rating, tone: femaRatingColor(fema.rating), icon: 'disasters' },
    schools?.count != null && { label: 'Public schools', value: num(schools.count), icon: 'schools' },
    { label: 'Sex offenders', value: num(offenders.length), icon: 'offenders' },
  ].filter(Boolean);

  const crumbs = [
    { name: 'Homefacts', path: '/homefacts' },
    { name: c.stateName, path: hfStatePath(state) },
    { name: c.city, path: hfCityPath(state, city) },
  ];
  const faqs = cityFaqs({ city: c.city, stateName: c.stateName, acs, fema, crime, schools, offenders: offenders.length, county });
  const navItems = [
    ...HF_MODULES.map((m) => ({ id: m.id, label: m.label })),
    inmateNames.length > 0 && { id: 'incarceration', label: 'Incarceration records' },
    faqs.length > 0 && { id: 'faq', label: 'FAQ' },
  ].filter(Boolean);

  return (
    <div style={hf.page}>
      <HfHeader />
      <main style={hf.main}>
        <JsonLd blocks={faqs.length > 0 ? [crumbsJsonLd(crumbs), faqJsonLd(faqs)] : [crumbsJsonLd(crumbs)]} />
        <HfBreadcrumbs crumbs={crumbs} />
        <FromBanner city={c.city} stateCode={c.stateCode} />

        <section style={{ ...hf.card, marginBottom: 8, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${hfColor.accentSoft} 0%, ${hfColor.surface} 62%)` }}>
          <TopoMotif color={hfColor.accent} opacity={0.06} />
          <div style={{ position: 'relative' }}>
            <p style={{ ...hf.eyebrow, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <HfIcon name="neighborhood" size={14} color={hfColor.accent} /> Neighborhood report
            </p>
            <h1 style={hf.h1}>{c.city}, {c.stateCode}</h1>
            {chips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {chips.map((ch) => <span key={ch} style={hf.chip}>{ch}</span>)}
              </div>
            )}
            <SummaryBand items={summary} />
          </div>
        </section>

        <AddressSafetySummary
          offenders={offenders.map((o) => ({ lat: o.latitude, lng: o.longitude }))}
          schools={schools ? schools.sample.map((s) => ({ lat: s.lat, lng: s.lng })) : []}
        />
        <WhatsNearby />

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
                <div style={{ fontSize: 12.5, fontWeight: 700, color: hfColor.body, marginBottom: 6 }}>Residents by race &amp; ethnicity</div>
                {eth.map((e) => <Bar key={e.label} label={e.label} pct={e.value} right={`${e.value}%`} />)}
              </div>
            )}
            {occupations.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: hfColor.body, marginBottom: 6 }}>Workforce by occupation</div>
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
            {schools.sample.some((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)) && (
              <div style={{ marginBottom: 14 }}>
                <OffenderMap
                  center={c.lat != null ? { lat: c.lat, lng: c.lng } : null}
                  points={schools.sample.map((s) => ({ lat: s.lat, lng: s.lng, label: s.name, sub: [s.level, s.lo && s.hi ? `Grades ${s.lo}–${s.hi}` : null].filter(Boolean).join(' · ') }))}
                  color="#12507e" height={300}
                />
              </div>
            )}
            <NearestToAddress title="Schools nearest your address"
              items={schools.sample.map((s) => ({ lat: s.lat, lng: s.lng, label: s.name, sub: s.level }))} />
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

        {/* 5 · Crime — FBI UCR/NIBRS via CDE (live where the city's police agency reports) */}
        {crime && (crime.violent || crime.property) ? (
          <Section id="crime" eyebrow="Safety" title="Crime"
            source={`Rate per 100,000 residents/year, ${crime.agency}, ${crime.year}. Source: FBI UCR/NIBRS (Crime Data Explorer).`}>
            {[crime.violent, crime.property].filter(Boolean).map((row) => {
              const max = Math.max(row.place || 0, row.state || 0, row.us || 0, 1);
              const above = row.us != null && row.place != null && row.place > row.us;
              const placeColor = above ? '#b23a48' : '#2e7d52';
              const delta = row.us ? Math.round(((row.place - row.us) / row.us) * 100) : null;
              return (
                <div key={row.kind} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: hfColor.ink, textTransform: 'capitalize' }}>{row.kind} crime</span>
                    {delta != null && <span style={{ fontSize: 12.5, fontWeight: 700, color: placeColor }}>{Math.abs(delta)}% {delta >= 0 ? 'above' : 'below'} national</span>}
                  </div>
                  <Bar label={c.city} pct={(row.place / max) * 100} color={placeColor} right={`${num(row.place)}`} />
                  {row.state != null && <Bar label={c.stateName} pct={(row.state / max) * 100} color={hfColor.muted} right={`${num(row.state)}`} />}
                  {row.us != null && <Bar label="United States" pct={(row.us / max) * 100} color={hfColor.faint} right={`${num(row.us)}`} />}
                </div>
              );
            })}
          </Section>
        ) : (
          <Pending id="crime" eyebrow="Safety" title="Crime" source="FBI Crime Data Explorer (UCR/NIBRS, public)" blurb={`Violent and property crime rates for ${c.city} vs ${c.stateName} and national averages.`} />
        )}

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
            right={fema.rating ? <RiskMeter rating={fema.rating} /> : null}
            source="County-level natural-hazard risk. Source: FEMA National Risk Index.">
            {fema.hazards && fema.hazards.length > 0 && (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: hfColor.body, marginBottom: 6 }}>Top hazards{fema.county ? ` · ${fema.county} County` : ''}</div>
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
              <div style={{ fontSize: 12.5, fontWeight: 700, color: hfColor.body, marginBottom: 6 }}>Population trend</div>
              <PopChart points={popPoints} width={680} height={220} />
            </div>
          )}
          {c.lat != null && c.lng != null && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: hfColor.body, marginBottom: 6 }}>Map of {c.city}</div>
              <AreaMap lat={c.lat} lng={c.lng} label={`${c.city}, ${c.stateCode}`} zoom={12} height={320} />
            </div>
          )}
          {stateCities.length >= 3 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: hfColor.body, marginBottom: 6 }}>Where {c.city} is</div>
              <StateMap cities={stateCities} name={c.stateName} highlight={c.city} width={680} height={360} />
            </div>
          )}
          {historic && historic.count > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: hfColor.body, marginBottom: 6 }}>Historic places</div>
              <p style={{ margin: '0 0 8px', fontSize: 14, color: hfColor.body }}>{num(historic.count)} on the National Register of Historic Places{historic.nhl > 0 ? `, incl. ${historic.nhl} National Historic Landmark${historic.nhl === 1 ? '' : 's'}` : ''}.</p>
              <div style={hf.linkGrid}>
                {historic.places.slice(0, 12).map((p, i) => (p.url ? <a key={i} href={p.url} target="_blank" rel="noopener" style={{ ...hf.link, fontSize: 14 }}>{p.name}</a> : <span key={i} style={{ fontSize: 14, color: hfColor.body }}>{p.name}</span>))}
              </div>
            </div>
          )}
          {people && people.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: hfColor.body, marginBottom: 6 }}>Notable people from {c.city}</div>
              <div style={hf.linkGrid}>{people.slice(0, 10).map((p) => <a key={p.url} href={p.url} target="_blank" rel="noopener" style={{ ...hf.link, fontSize: 14 }}>{p.name}</a>)}</div>
            </div>
          )}
          {names.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: hfColor.body, marginBottom: 6 }}>People searches in {c.city}</div>
              <div style={hf.linkGrid}>
                {names.slice(0, 24).map((n) => (
                  <a key={n.slug} href={cityNamePath(c.stateCode, city, n.slug)} style={{ ...hf.link, fontSize: 14 }}>
                    {n.name}{n.estInCity ? <span style={{ color: hfColor.muted }}> ({num(n.estInCity)})</span> : null}
                  </a>
                ))}
              </div>
            </div>
          )}
          {nearby.length > 0 && (
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: hfColor.body, marginBottom: 6 }}>Nearby cities</div>
              <div style={hf.linkGrid}>{nearby.map((n) => <a key={n.slug} href={hfCityPath(state, n.slug)} style={{ ...hf.link, fontSize: 14 }}>{n.city} <span style={{ color: hfColor.muted }}>({num(n.miles)} mi)</span></a>)}</div>
            </div>
          )}
        </Section>

        {/* Incarceration — first-party public records (county grain; records carry county, not city) */}
        {inmateNames.length > 0 && county && (
          <Section id="incarceration" eyebrow="Public records" title={`Incarceration records — ${county.name} County`}
            source="Names with the most public booking/incarceration records in the county. Source: state & county correctional rosters (first-party).">
            <p style={{ margin: '0 0 12px', fontSize: 15, color: hfColor.body, lineHeight: 1.6 }}>
              Most-recorded names in <a href={hfCountyPath(state, county.slug)} style={hf.link}>{county.name} County</a> booking &amp; incarceration records:
            </p>
            <div style={hf.linkGrid}>
              {inmateNames.slice(0, 24).map((n) => (
                <a key={n.slug} href={`/people/${c.stateCode.toLowerCase()}/county/${county.slug}/${n.slug}`} style={{ ...hf.link, fontSize: 14 }}>
                  {n.name}{n.count ? <span style={{ color: hfColor.muted }}> ({num(n.count)})</span> : null}
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* 9 · Sex offenders — map (pins) + list */}
        <div id="offenders" style={hf.card}>
          {offenders.some((o) => Number.isFinite(o.latitude) && Number.isFinite(o.longitude)) && (
            <div style={{ marginBottom: 16 }}>
              <OffenderMap
                center={c.lat != null ? { lat: c.lat, lng: c.lng } : null}
                points={offenders.map((o) => ({ lat: o.latitude, lng: o.longitude, label: o.name || 'Registered offender', sub: [o.city, o.absconder ? 'ABSCONDER' : null].filter(Boolean).join(' · ') }))}
                height={340}
              />
            </div>
          )}
          <NearestToAddress title="Registered offenders nearest your address" accent="#b23a48"
            items={offenders.map((o) => ({ lat: o.latitude, lng: o.longitude, label: o.name || 'Registered offender', sub: [o.city, o.absconder ? 'ABSCONDER' : null].filter(Boolean).join(' · ') }))} />
          <SexOffenderSection
            records={offenders}
            heading={`Registered sex offenders in ${c.city}, ${c.stateCode} (${offenders.length})`}
            blurb={`Public sex-offender registry records for ${c.city}, ${c.stateName}.`}
          />
        </div>

        {faqs.length > 0 && (
          <Section id="faq" eyebrow="Common questions" title={`${c.city} — frequently asked`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {faqs.map((f, i) => (
                <div key={i}>
                  <div style={{ fontSize: 15, fontWeight: 750, color: hfColor.ink, marginBottom: 4 }}>{f.q}</div>
                  <div style={{ fontSize: 14, color: hfColor.body, lineHeight: 1.6 }}>{f.a}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=homefacts&state=${c.stateCode}`} style={hf.secondaryCta}>
          Look up a person in {c.city} →
        </a>

        <FcraFooter />
      </main>
    </div>
  );
}
