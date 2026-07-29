// HomeFacts landing — /homefacts. Search a city/town → an area-profile page (neighborhood report, demographics,
// property, schools, crime, environment, disasters, neighborhood info, sex offenders). Built on the same
// public-data engine as the /people directory. Server component; the search box is the one client island.
import STATE_SLICE from '../../data/state-slice.json';
import { ui, FcraFooter, JsonLd } from '../../lib/ui';
import { SITE } from '../../lib/site';
import { HF_MODULES, hfCityPath } from '../../lib/homefacts';
import HomefactsSearch from './HomefactsSearch';

export const revalidate = 5184000; // 60d ISR
export function generateStaticParams() { return []; }

export function generateMetadata() {
  return {
    title: 'HomeFacts — Neighborhood Reports: Crime, Schools, Property & Demographics | IDLookup',
    description: 'Free neighborhood reports for any U.S. city — demographics, property values, schools, crime, environmental hazards, natural-disaster risk, and the registered sex-offender registry. Search a city to see its area profile.',
    alternates: { canonical: `${SITE}/homefacts` },
  };
}

// Compact city index for the client typeahead (built once at generation; ~2,000 rows).
function buildIndex() {
  const out = [];
  for (const lc of Object.keys(STATE_SLICE.states)) {
    const st = STATE_SLICE.states[lc];
    for (const c of st.cities) out.push({ c: c.city, s: lc, n: st.name, slug: c.slug, pop: c.pop });
  }
  return out;
}
function popularCities(index, n = 24) {
  return index.slice().sort((a, b) => (b.pop || 0) - (a.pop || 0)).slice(0, n);
}

const num = (v) => (v == null ? '' : Number(v).toLocaleString('en-US'));

const hero = {
  background: 'linear-gradient(140deg, #0d5d2f 0%, #084825 100%)',
  color: '#fff', borderRadius: 12, padding: '44px 26px', textAlign: 'center', marginBottom: 22,
};
const modGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginTop: 4 };
const modCell = { background: ui.color.soft, border: `1px solid ${ui.color.softBorder}`, borderRadius: 8, padding: '12px 14px' };
const badge = (live) => ({
  fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', borderRadius: 5, padding: '2px 6px',
  color: live ? '#0d5d2f' : '#8a6d3b', background: live ? '#e7f3ec' : '#fbf1e0', border: `1px solid ${live ? '#c3dcec' : '#ecd6ac'}`,
});

export default function HomefactsLanding() {
  const index = buildIndex();
  const popular = popularCities(index);
  const jsonLd = [{
    '@context': 'https://schema.org', '@type': 'WebSite', name: 'HomeFacts by IDLookup',
    url: `${SITE}/homefacts`, description: 'Neighborhood reports for any U.S. city.',
  }];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />

      <section style={hero}>
        <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', opacity: 0.85 }}>Neighborhood reports</p>
        <h1 style={{ margin: '0 0 10px', fontSize: 34, lineHeight: 1.12 }}>Know any neighborhood — and who&apos;s in it.</h1>
        <p style={{ margin: '0 auto 20px', fontSize: 16, lineHeight: 1.6, maxWidth: '52ch', opacity: 0.92 }}>
          Demographics, property values, schools, crime, environmental &amp; disaster risk, and the registered
          sex-offender registry for every U.S. city — free.
        </p>
        <HomefactsSearch cities={index} />
      </section>

      <section style={ui.card}>
        <h2 style={ui.h2}>What&apos;s in an area profile</h2>
        <p style={{ ...ui.muted, margin: '0 0 12px', fontSize: 14 }}>
          Nine modules for every city — built on public-domain and first-party data. Live now; the rest are being
          wired to their public sources (each named).
        </p>
        <div style={modGrid}>
          {HF_MODULES.map((m) => (
            <div key={m.id} style={modCell}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: ui.color.ink }}>{m.label}</span>
                <span style={badge(m.status === 'live')}>{m.status === 'live' ? 'Live' : 'Soon'}</span>
              </div>
              {m.source && <div style={{ fontSize: 11, color: ui.color.faint, marginTop: 4 }}>{m.source}</div>}
            </div>
          ))}
        </div>
      </section>

      <section style={ui.card}>
        <h2 style={ui.h2}>Popular cities</h2>
        <div style={ui.linkGrid}>
          {popular.map((c) => (
            <a key={`${c.s}/${c.slug}`} href={hfCityPath(c.s, c.slug)} style={{ ...ui.link, fontSize: 14 }}>
              {c.c}, {c.s.toUpperCase()} <span style={ui.muted}>(~{num(c.pop)})</span>
            </a>
          ))}
        </div>
      </section>

      <FcraFooter />
    </main>
  );
}
