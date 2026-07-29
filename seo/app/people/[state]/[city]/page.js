// City landing — /people/{state}/{city}, e.g. /people/tx/houston. Middle of the
// state → city → name taxonomy: lists the most-common (resolvable) names in the
// city, each linking to a name-in-city page.
import { notFound } from 'next/navigation';
import { getCitySlice, getCityTopNames, getStateCities, getNearbyCities, getStateTopNames } from '../../../../lib/directory';
import { getCityAcs, getCityWiki, getCityPeople, getCityHistoric, getCityNewspapers, getPopHistory, cityWikiChips, cityStats, cityEthnicity, cityOccupations, cityProse } from '../../../../lib/facts';
import { StateMap } from '../../../../lib/statemap';
import { PopChart } from '../../../../lib/popchart';
import { statePath, cityPath, cityNamePath } from '../../../../lib/ids';
import { collectionJsonLd, crumbsJsonLd } from '../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../lib/ui';
import { SITE, MAIN } from '../../../../lib/site';
import { resolveNameInState, nameInStateMetadata, nameInStatePath, NameInStateView } from '../../../../lib/name-in-state';
import { querySexOffenders } from '../../../../lib/sexOffenderDb.mjs';
import { SexOffenderSection } from '../../../../lib/sex-offender-section';

export const revalidate = 5184000; // 60d
// ISR (SEO 2026-07-18): [] + dynamicParams=true → each page is generated on first hit and CACHED for
// `revalidate` instead of live-rendering per request (which returned private/no-store and made every
// Googlebot hit a live Neon render → transient 404s). Flips this route from ƒ Dynamic → ● cached.
export function generateStaticParams() { return []; }

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const withTimeout = (promise, fallback, ms = 1200) =>
  Promise.race([
    promise.catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);

const snap = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, margin: '4px 0 4px' },
  cell: { background: '#f8faf9', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', fontWeight: 700 },
  value: { fontSize: 20, fontWeight: 800, color: '#0d5d2f', marginTop: 2 },
  barRow: { display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0', fontSize: 13 },
  barTrack: { flex: 1, height: 8, background: '#eef2f0', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', background: '#0d5d2f' },
};

export async function generateMetadata({ params }) {
  const { state, city } = await params;
  const c = getCitySlice(state, city);
  // Not a real city? It may be an indexed name-in-state URL (/people/{state}/{first-last}).
  if (!c) return nameInStateMetadata(state, city, nameInStatePath(state, city));
  return {
    title: `People Search in ${c.city}, ${c.stateCode} — Find Anyone by Name | IDLookup`,
    description: `Search for people in ${c.city}, ${c.stateName}. Browse the most common names in ${c.city} and find addresses, phone numbers, ages, and relatives.`,
    alternates: { canonical: `${SITE}${cityPath(state, city)}` },
  };
}

export default async function CityLanding({ params }) {
  const { state, city } = await params;
  const c = getCitySlice(state, city);
  if (!c) {
    // Fall back to the shared name-in-state view for indexed /people/{state}/{first-last} URLs.
    if (resolveNameInState(state, city)) return <NameInStateView state={state} name={city} />;
    notFound();
  }

  const names = getCityTopNames(state, city, 60);
  // Registered sex offenders in this city (location-native — SO records carry a real city, so this is
  // combo-unique per city, no cross-city dup). Owner-cleared display.
  const offenders = await withTimeout(querySexOffenders({ state: c.stateCode, city: c.city, limit: 16 }), []);
  // City-native names are limited by the strict common-name gate — often a handful (small states
  // scale the ~200 in-state floor down to only the very top names). Top every city page up to a
  // healthy names surface with the next most common STATE names (linked to name-in-state pages,
  // which resolve at the wider state gate — no 404s). Tunable: NAMES_TARGET.
  const NAMES_TARGET = 60;
  const fill = Math.max(0, NAMES_TARGET - names.length);
  const stateNames = fill > 0
    ? getStateTopNames(state, NAMES_TARGET + names.length)
        .filter((n) => !names.some((cn) => cn.slug === n.slug))
        .slice(0, fill)
    : [];
  const acs = getCityAcs(c.stateCode, city);
  const wiki = getCityWiki(c.stateCode, city);
  const chips = cityWikiChips(wiki);
  const stats = cityStats(acs);
  const eth = cityEthnicity(acs);
  const occupations = cityOccupations(acs);
  const prose = cityProse(c.city, c.stateName, acs, city, wiki);
  const stateCities = getStateCities(state);
  const nearby = getNearbyCities(state, city, 6);
  const people = getCityPeople(c.stateCode, city);
  const historic = getCityHistoric(c.stateCode, city);
  const newspapers = getCityNewspapers(c.stateCode, city);
  const popPoints = getPopHistory(c.stateCode, city, acs?.population);
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: c.stateName, path: statePath(state) },
    { name: c.city, path: cityPath(state, city) },
  ];
  const items = names.slice(0, 25).map((n) => ({ name: `${n.name} in ${c.city}`, path: cityNamePath(state, city, n.slug) }));
  const jsonLd = [
    collectionJsonLd({ name: `People Search in ${c.city}, ${c.stateCode}`, description: `The most common names in ${c.city}, ${c.stateName}.`, url: `${SITE}${cityPath(state, city)}`, items }),
    crumbsJsonLd(crumbs),
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>People Search in {c.city}, {c.stateCode}</h1>
      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '2px 0 12px' }}>
          {chips.map((ch) => (
            <span key={ch} style={{ fontSize: 12, color: '#374151', background: '#eef2f0', border: '1px solid #dbe5df', borderRadius: 999, padding: '3px 10px' }}>{ch}</span>
          ))}
        </div>
      )}
      <p style={{ ...ui.muted, margin: '0 0 14px', fontSize: 15 }}>
        Browse the most common names in {c.city} to find a specific person, or search directly.
      </p>

      <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory&state=${c.stateCode}`}
        style={{ ...ui.cta, display: 'block', textAlign: 'center', fontSize: 16, padding: '14px 22px', margin: '0 0 22px' }}>
        Search for anyone in {c.city} →
      </a>

      {stats.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>{c.city} at a glance</h2>
          <div style={snap.grid}>
            {stats.map((s) => (
              <div key={s.label} style={snap.cell}>
                <div style={snap.label}>{s.label}</div>
                <div style={snap.value}>{s.value}</div>
              </div>
            ))}
          </div>
          {eth.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ ...snap.label, marginBottom: 4 }}>Residents by race &amp; ethnicity</div>
              {eth.map((e) => (
                <div key={e.label} style={snap.barRow}>
                  <span style={{ width: 130, color: '#374151' }}>{e.label}</span>
                  <span style={snap.barTrack}><span style={{ ...snap.barFill, width: `${Math.min(100, e.value)}%` }} /></span>
                  <span style={{ width: 44, textAlign: 'right', color: '#6b7280' }}>{e.value}%</span>
                </div>
              ))}
            </div>
          )}
          {prose && <p style={{ margin: '14px 0 0', fontSize: 14, lineHeight: 1.65, color: '#374151' }}>{prose}</p>}
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>Source: U.S. Census Bureau, American Community Survey (5-year).</p>
        </section>
      )}

      {/* Most common names — the conversion surface. Placed #2, right below "at a glance"
          (owner 2026-07-13) so it isn't buried under the demographic modules. */}
      {names.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Most common names in {c.city}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 16px' }}>
            {names.map((n) => (
              <a key={n.slug} href={cityNamePath(state, city, n.slug)} style={{ ...ui.link, fontSize: 14 }}>
                {n.name} <span style={ui.muted}>(~{num(n.estInCity)})</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* State-level fallback so thin/small cities still have a rich names surface. Links go to
          the name-in-state pages (/people/{state}/{name}). */}
      {stateNames.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Popular names in {c.stateName}</h2>
          <p style={{ ...ui.muted, margin: '0 0 10px', fontSize: 13 }}>
            Common names across {c.stateName} — search any of them by city, age, and relatives.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 16px' }}>
            {stateNames.map((n) => (
              <a key={n.slug} href={nameInStatePath(state, n.slug)} style={{ ...ui.link, fontSize: 14 }}>
                {n.name} <span style={ui.muted}>(~{num(n.estInState)})</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {occupations.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Occupations in {c.city}</h2>
          {occupations.map((o) => (
            <div key={o.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 2 }}>
                <span>{o.label}</span><span style={{ color: '#6b7280', fontWeight: 700 }}>{o.value}%</span>
              </div>
              <span style={{ display: 'block', height: 8, background: '#eef2f0', borderRadius: 999, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', background: '#0d5d2f', width: `${Math.min(100, o.value)}%` }} />
              </span>
            </div>
          ))}
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>Share of employed residents (16+). Source: U.S. Census Bureau, ACS (5-year).</p>
        </section>
      )}

      {popPoints.length >= 4 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Population trend</h2>
          <PopChart points={popPoints} width={680} height={230} />
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>
            {popPoints[0].year}–{popPoints[popPoints.length - 1].year}. Sources: Wikidata (CC0) historical figures; latest from U.S. Census ACS.
          </p>
        </section>
      )}

      {stateCities.length >= 3 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Where {c.city} is</h2>
          <StateMap cities={stateCities} name={c.stateName} highlight={c.city} width={680} height={380} />
          <p style={{ margin: '10px 0 0', fontSize: 12, color: '#9ca3af' }}>{c.city} (highlighted) among major cities in {c.stateName}.</p>
        </section>
      )}

      {people && people.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Notable people from {c.city}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
            {people.slice(0, 10).map((p) => (
              <a key={p.url} href={p.url} target="_blank" rel="noopener" style={{ ...ui.link, fontSize: 14 }}>{p.name}</a>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>Born in {c.city}. Source: Wikidata / Wikipedia (CC0); links open Wikipedia.</p>
        </section>
      )}

      {historic && historic.count > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Historic places in {c.city}</h2>
          <p style={{ margin: '0 0 10px', fontSize: 14, color: '#374151' }}>
            {c.city} has <strong>{num(historic.count)}</strong> {historic.count === 1 ? 'place' : 'places'} on the National Register of Historic Places
            {historic.nhl > 0 ? <>, including <strong>{historic.nhl}</strong> National Historic Landmark{historic.nhl === 1 ? '' : 's'} (★)</> : null}.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            {historic.places.map((p, i) => {
              const star = p.nhl ? <span style={{ color: '#b45309', fontWeight: 700 }}> ★</span> : null;
              return p.url
                ? <a key={i} href={p.url} target="_blank" rel="noopener" style={{ ...ui.link, fontSize: 14 }}>{p.name}{star}</a>
                : <span key={i} style={{ fontSize: 14, color: '#374151' }}>{p.name}{star}</span>;
            })}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>★ = National Historic Landmark. Source: NPS National Register of Historic Places.</p>
        </section>
      )}

      {newspapers && newspapers.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Historic newspapers of {c.city}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {newspapers.map((p, i) => (
              <span key={i} style={{ fontSize: 14, color: '#374151' }}>
                {p.name}{p.years ? <span style={ui.muted}> · {p.years}</span> : null}
              </span>
            ))}
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#9ca3af' }}>Source: Library of Congress, Chronicling America (public domain).</p>
        </section>
      )}

      {nearby.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Cities near {c.city}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px' }}>
            {nearby.map((n) => (
              <a key={n.slug} href={cityPath(state, n.slug)} style={{ ...ui.link, fontSize: 14 }}>
                {n.city} <span style={ui.muted}>({num(n.miles)} mi)</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <SexOffenderSection
        records={offenders}
        heading={`Registered sex offenders in ${c.city}, ${c.stateCode} (${offenders.length})`}
        blurb={`Public sex-offender registry records for people in ${c.city}, ${c.stateName}.`}
      />

      <a href={`${MAIN}/name/landing/v2?utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory&state=${c.stateCode}`} style={ui.cta}>Search people in {c.city} →</a>

      <FcraFooter />
    </main>
  );
}
