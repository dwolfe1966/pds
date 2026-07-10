// City landing — /people/{state}/{city}, e.g. /people/tx/houston. Middle of the
// state → city → name taxonomy: lists the most-common (resolvable) names in the
// city, each linking to a name-in-city page.
import { notFound } from 'next/navigation';
import { getCitySlice, getCityTopNames } from '../../../../lib/directory';
import { getCityAcs, cityStats, cityEthnicity, cityProse } from '../../../../lib/facts';
import { statePath, cityPath, cityNamePath } from '../../../../lib/ids';
import { collectionJsonLd, crumbsJsonLd } from '../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../lib/ui';
import { SITE, MAIN } from '../../../../lib/site';

export const revalidate = 5184000; // 60d

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));

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
  if (!c) return { title: 'Not found' };
  return {
    title: `People Search in ${c.city}, ${c.stateCode} — Find Anyone by Name | IDLookup`,
    description: `Search for people in ${c.city}, ${c.stateName}. Browse the most common names in ${c.city} and find addresses, phone numbers, ages, and relatives.`,
    alternates: { canonical: `${SITE}${cityPath(state, city)}` },
  };
}

export default async function CityLanding({ params }) {
  const { state, city } = await params;
  const c = getCitySlice(state, city);
  if (!c) notFound();

  const names = getCityTopNames(state, city, 60);
  const acs = getCityAcs(c.stateCode, city);
  const stats = cityStats(acs);
  const eth = cityEthnicity(acs);
  const prose = cityProse(c.city, c.stateName, acs, city);
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
      <p style={{ ...ui.muted, margin: '0 0 20px', fontSize: 15 }}>
        Browse the most common names in {c.city} to find a specific person, or search directly.
      </p>

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

      <a href={`${MAIN}/name/landing/v2?utm_source=seo&utm_medium=organic&state=${c.stateCode}`} style={ui.cta}>Search people in {c.city} →</a>

      <FcraFooter />
    </main>
  );
}
