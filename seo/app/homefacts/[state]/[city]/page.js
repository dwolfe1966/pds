// HomeFacts area profile — /homefacts/{state}/{city}, e.g. /homefacts/tx/austin. A place-centric neighborhood
// report: nine modules (summary, demographics, property, schools, crime, environment, disasters, neighborhood,
// sex offenders) on the same public-data engine as the /people directory. Live modules render real ACS /
// Wikidata / first-party sex-offender data; pending modules name the public source being wired (no fabrication).
import { notFound } from 'next/navigation';
import { getCitySlice, getStateCities, getNearbyCities } from '../../../../lib/directory';
import {
  getCityAcs, getCityWiki, getCityPeople, getCityHistoric, getCityNewspapers, getPopHistory,
  cityWikiChips, cityEthnicity, cityOccupations, cityProse,
} from '../../../../lib/facts';
import { propertyStats, demographicStats, HF_MODULES, hfCityPath, hfStatePath } from '../../../../lib/homefacts';
import { StateMap } from '../../../../lib/statemap';
import { PopChart } from '../../../../lib/popchart';
import { crumbsJsonLd } from '../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../lib/ui';
import { SITE, MAIN } from '../../../../lib/site';
import { querySexOffenders } from '../../../../lib/sexOffenderDb.mjs';
import { SexOffenderSection } from '../../../../lib/sex-offender-section';

export const revalidate = 5184000; // 60d ISR
export function generateStaticParams() { return []; }

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const money = (n) => (n == null ? null : '$' + Number(n).toLocaleString('en-US'));
const withTimeout = (promise, fallback, ms = 1200) =>
  Promise.race([promise.catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);

const snap = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, margin: '4px 0' },
  cell: { background: ui.color.soft, border: `1px solid ${ui.color.softBorder}`, borderRadius: 8, padding: '12px 14px' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: ui.color.muted, fontWeight: 800 },
  value: { fontSize: 20, fontWeight: 800, color: ui.color.accent, marginTop: 2 },
  barRow: { display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0', fontSize: 13 },
  barTrack: { flex: 1, height: 8, background: '#eef2f0', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', background: ui.color.accent },
};
const jump = {
  wrap: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  link: { fontSize: 13, fontWeight: 700, color: ui.color.body, background: ui.color.soft, border: `1px solid ${ui.color.softBorder}`, borderRadius: 999, padding: '6px 12px', textDecoration: 'none' },
  soon: { fontSize: 9, fontWeight: 800, marginLeft: 6, color: '#8a6d3b' },
};

function StatGrid({ stats }) {
  return (
    <div style={snap.grid}>
      {stats.map((s) => (
        <div key={s.label} style={snap.cell}><div style={snap.label}>{s.label}</div><div style={snap.value}>{s.value}</div></div>
      ))}
    </div>
  );
}

// Honest placeholder for a module whose public source isn't ingested yet — names the real source, no fake data.
function Pending({ id, title, source, blurb }) {
  return (
    <section id={id} style={ui.card}>
      <h2 style={ui.h2}>{title}</h2>
      <p style={{ margin: '0 0 8px', fontSize: 14, color: ui.color.body, lineHeight: 1.65 }}>{blurb}</p>
      <p style={ui.source}>Data source being added: {source}. We show real, sourced figures only — never estimates.</p>
    </section>
  );
}

export async function generateMetadata({ params }) {
  const { state, city } = await params;
  const c = getCitySlice(state, city);
  if (!c) return {};
  return {
    title: `${c.city}, ${c.stateCode} Neighborhood Report — Demographics, Property, Crime & Sex Offenders | HomeFacts`,
    description: `Area profile for ${c.city}, ${c.stateName}: demographics, home values and rents, schools, crime, environmental and natural-disaster risk, neighborhood info, and the registered sex-offender registry.`,
    alternates: { canonical: `${SITE}${hfCityPath(state, city)}` },
  };
}

export default async function AreaProfile({ params, searchParams }) {
  const { state, city } = await params;
  const sp = searchParams ? await searchParams : {};
  const from = typeof sp.from === 'string' ? sp.from : null; // set by the ZIP/address resolver
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

  // Highlight snapshot for the summary (curated, not the full demographic set below).
  const highlight = [
    acs?.population != null && { label: 'Population', value: num(acs.population) },
    acs?.medianAge != null && { label: 'Median age', value: `${acs.medianAge}` },
    acs?.medianHouseholdIncome != null && { label: 'Median income', value: money(acs.medianHouseholdIncome) },
    acs?.medianHomeValue != null && { label: 'Median home value', value: money(acs.medianHomeValue) },
  ].filter(Boolean);

  const crumbs = [
    { name: 'HomeFacts', path: '/homefacts' },
    { name: c.stateName, path: hfStatePath(state) },
    { name: c.city, path: hfCityPath(state, city) },
  ];
  const jsonLd = [crumbsJsonLd(crumbs)];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      {from && (
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: ui.color.body, background: ui.color.tint, border: '1px solid #d7e8dc', borderRadius: 8, padding: '9px 13px' }}>
          Showing <strong>{c.city}, {c.stateCode}</strong> — the area we cover for <strong>{from}</strong>.
        </p>
      )}

      <section style={ui.hero}>
        <p style={ui.eyebrow}>Neighborhood report</p>
        <h1 style={ui.h1}>{c.city}, {c.stateCode} Area Profile</h1>
        {chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0 4px' }}>
            {chips.map((ch) => <span key={ch} style={ui.chip}>{ch}</span>)}
          </div>
        )}
        {prose && <p style={{ ...ui.lead, marginTop: 12 }}>{prose}</p>}
        <nav style={jump.wrap} aria-label="Report sections">
          {HF_MODULES.map((m) => (
            <a key={m.id} href={`#${m.id}`} style={jump.link}>
              {m.label}{m.status !== 'live' && <span style={jump.soon}>soon</span>}
            </a>
          ))}
        </nav>
      </section>

      {/* 1 · Neighborhood report & summary */}
      {highlight.length > 0 && (
        <section id="summary" style={ui.card}>
          <h2 style={ui.h2}>{c.city} at a glance</h2>
          <StatGrid stats={highlight} />
          <p style={ui.source}>Source: U.S. Census Bureau, American Community Survey (5-year).</p>
        </section>
      )}

      {/* 2 · Demographics */}
      {demo.length > 0 && (
        <section id="demographics" style={ui.card}>
          <h2 style={ui.h2}>Demographics</h2>
          <StatGrid stats={demo} />
          {eth.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...snap.label, marginBottom: 4 }}>Residents by race &amp; ethnicity</div>
              {eth.map((e) => (
                <div key={e.label} style={snap.barRow}>
                  <span style={{ width: 130, color: ui.color.body }}>{e.label}</span>
                  <span style={snap.barTrack}><span style={{ ...snap.barFill, width: `${Math.min(100, e.value)}%` }} /></span>
                  <span style={{ width: 44, textAlign: 'right', color: ui.color.muted }}>{e.value}%</span>
                </div>
              ))}
            </div>
          )}
          {occupations.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...snap.label, marginBottom: 4 }}>Workforce by occupation</div>
              {occupations.map((o) => (
                <div key={o.label} style={snap.barRow}>
                  <span style={{ width: 200, color: ui.color.body, fontSize: 12.5 }}>{o.label}</span>
                  <span style={snap.barTrack}><span style={{ ...snap.barFill, width: `${Math.min(100, o.value)}%` }} /></span>
                  <span style={{ width: 44, textAlign: 'right', color: ui.color.muted }}>{o.value}%</span>
                </div>
              ))}
            </div>
          )}
          <p style={ui.source}>Source: U.S. Census Bureau, American Community Survey (5-year).</p>
        </section>
      )}

      {/* 3 · Property report */}
      {prop.length > 0 && (
        <section id="property" style={ui.card}>
          <h2 style={ui.h2}>Property report</h2>
          <StatGrid stats={prop} />
          <p style={ui.source}>Area-level figures. Source: U.S. Census Bureau, ACS (5-year). Parcel-level records coming next.</p>
        </section>
      )}

      {/* 4 · Schools */}
      <Pending id="schools" title="Schools"
        source="U.S. Dept. of Education / NCES (public)"
        blurb={`Public, private and charter schools serving ${c.city}, with enrollment and ratings.`} />

      {/* 5 · Crime */}
      <Pending id="crime" title="Crime"
        source="FBI Crime Data Explorer + local agencies (public)"
        blurb={`Violent and property crime rates for ${c.city} and how they compare to ${c.stateName} and national averages.`} />

      {/* 6 · Environmental hazards */}
      <Pending id="environment" title="Environmental hazards"
        source="U.S. EPA — EJScreen / ECHO (public)"
        blurb={`Air quality, toxic-release sites, and regulated facilities in and around ${c.city}.`} />

      {/* 7 · Natural disasters */}
      <Pending id="disasters" title="Natural disaster risk"
        source="FEMA National Risk Index (public)"
        blurb={`Risk from flood, wildfire, tornado, earthquake, hurricane and other hazards for ${c.city}'s county.`} />

      {/* 8 · Neighborhood info */}
      <section id="neighborhood" style={ui.card}>
        <h2 style={ui.h2}>Neighborhood info</h2>
        {wiki && (wiki.founded || wiki.county || wiki.elevationM != null || wiki.nickname) && (
          <p style={{ margin: '0 0 12px', fontSize: 14, color: ui.color.body, lineHeight: 1.65 }}>
            {c.city}
            {wiki.founded ? ` was founded in ${wiki.founded}` : ''}
            {wiki.county ? `${wiki.founded ? ' and' : ''} sits in ${wiki.county}` : ''}
            {wiki.nickname ? `, nicknamed “${wiki.nickname}”` : ''}
            {wiki.elevationM != null ? `. Elevation ~${num(wiki.elevationM)} m` : ''}.
          </p>
        )}
        {popPoints.length >= 4 && (
          <>
            <div style={{ ...snap.label, marginBottom: 6 }}>Population trend</div>
            <PopChart points={popPoints} width={680} height={220} />
            <p style={ui.source}>{popPoints[0].year}–{popPoints[popPoints.length - 1].year}. Sources: Wikidata (CC0); latest from U.S. Census ACS.</p>
          </>
        )}
        {stateCities.length >= 3 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ ...snap.label, marginBottom: 6 }}>Where {c.city} is</div>
            <StateMap cities={stateCities} name={c.stateName} highlight={c.city} width={680} height={360} />
          </div>
        )}
        {historic && historic.count > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ ...snap.label, marginBottom: 6 }}>Historic places</div>
            <p style={{ margin: '0 0 8px', fontSize: 14, color: ui.color.body }}>
              {num(historic.count)} on the National Register of Historic Places
              {historic.nhl > 0 ? `, incl. ${historic.nhl} National Historic Landmark${historic.nhl === 1 ? '' : 's'}` : ''}.
            </p>
            <div style={ui.linkGrid}>
              {historic.places.slice(0, 12).map((p, i) => (
                p.url
                  ? <a key={i} href={p.url} target="_blank" rel="noopener" style={{ ...ui.link, fontSize: 14 }}>{p.name}</a>
                  : <span key={i} style={{ fontSize: 14, color: ui.color.body }}>{p.name}</span>
              ))}
            </div>
            <p style={ui.source}>Source: NPS National Register of Historic Places.</p>
          </div>
        )}
        {people && people.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ ...snap.label, marginBottom: 6 }}>Notable people from {c.city}</div>
            <div style={ui.linkGrid}>
              {people.slice(0, 10).map((p) => (
                <a key={p.url} href={p.url} target="_blank" rel="noopener" style={{ ...ui.link, fontSize: 14 }}>{p.name}</a>
              ))}
            </div>
            <p style={ui.source}>Source: Wikidata / Wikipedia (CC0).</p>
          </div>
        )}
        {newspapers && newspapers.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ ...snap.label, marginBottom: 6 }}>Historic newspapers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {newspapers.map((p, i) => (
                <span key={i} style={{ fontSize: 14, color: ui.color.body }}>{p.name}{p.years ? <span style={ui.muted}> · {p.years}</span> : null}</span>
              ))}
            </div>
            <p style={ui.source}>Source: Library of Congress, Chronicling America (public domain).</p>
          </div>
        )}
        {nearby.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ ...snap.label, marginBottom: 6 }}>Nearby cities</div>
            <div style={ui.linkGrid}>
              {nearby.map((n) => (
                <a key={n.slug} href={hfCityPath(state, n.slug)} style={{ ...ui.link, fontSize: 14 }}>
                  {n.city} <span style={ui.muted}>({num(n.miles)} mi)</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 9 · Sex offenders */}
      <div id="offenders">
        <SexOffenderSection
          records={offenders}
          heading={`Registered sex offenders in ${c.city}, ${c.stateCode} (${offenders.length})`}
          blurb={`Public sex-offender registry records for ${c.city}, ${c.stateName}. Neighborhood-safety information from the public registry.`}
        />
      </div>

      <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=homefacts&state=${c.stateCode}`} style={ui.secondaryCta}>
        Look up a person in {c.city} →
      </a>

      <FcraFooter />
    </main>
  );
}
