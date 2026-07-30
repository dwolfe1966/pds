// HomeFacts landing — /homefacts. Search a city / ZIP / address → an area profile (city · county · zip · address).
// Built on the same public-data engine as the /people directory. Server component; search is the one client island.
import STATE_SLICE from '../../data/state-slice.json';
import { hf, hfColor, BRAND, HfHeader } from '../../lib/hf';
import { FcraFooter, JsonLd } from '../../lib/ui';
import { SITE } from '../../lib/site';
import { HF_MODULES, hfCityPath, getCounties } from '../../lib/homefacts';
import HomefactsSearch from './HomefactsSearch';

export const revalidate = 5184000; // 60d ISR
export function generateStaticParams() { return []; }

export function generateMetadata() {
  return {
    title: 'Homefacts — Neighborhood Reports: Crime, Schools, Property & Demographics | IDLookup',
    description: 'Free neighborhood reports for any U.S. city, county, or ZIP — demographics, property values, schools, natural-disaster risk, environmental hazards, and the registered sex-offender registry. Search an address to see its area profile.',
    alternates: { canonical: `${SITE}/homefacts` },
  };
}

function buildIndex() {
  const out = [];
  for (const lc of Object.keys(STATE_SLICE.states)) {
    const st = STATE_SLICE.states[lc];
    for (const c of st.cities) out.push({ c: c.city, s: lc, n: st.name, slug: c.slug, pop: c.pop });
  }
  return out;
}
const num = (v) => (v == null ? '' : Number(v).toLocaleString('en-US'));

function buildCountyIndex() {
  const out = [];
  for (const lc of Object.keys(STATE_SLICE.states)) {
    for (const c of getCounties(lc)) out.push({ n: c.name, s: lc, slug: c.slug });
  }
  return out;
}

export default function HomefactsLanding() {
  const index = buildIndex();
  const countyIndex = buildCountyIndex();
  const popular = index.slice().sort((a, b) => (b.pop || 0) - (a.pop || 0)).slice(0, 24);
  const jsonLd = [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Homefacts by IDLookup', url: `${SITE}/homefacts`, description: 'Neighborhood reports for any U.S. city, county, or ZIP.' }];

  return (
    <div style={hf.page}>
      <HfHeader />
      <main style={hf.main}>
        <JsonLd blocks={jsonLd} />

        <section style={{ background: `linear-gradient(140deg, ${BRAND.accent} 0%, ${BRAND.accentDark} 100%)`, color: '#fff', borderRadius: 16, padding: 'clamp(30px,5vw,52px) clamp(20px,4vw,40px)', textAlign: 'center', marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.8 }}>Neighborhood reports</p>
          <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(28px,4.6vw,42px)', fontWeight: 840, letterSpacing: '-.03em', lineHeight: 1.08 }}>Know any neighborhood — and who&apos;s in it.</h1>
          <p style={{ margin: '0 auto 22px', fontSize: 16, lineHeight: 1.6, maxWidth: '54ch', opacity: 0.92 }}>
            Demographics, property values, schools, natural-disaster &amp; environmental risk, and the registered
            sex-offender registry for any U.S. city, county, or ZIP — free.
          </p>
          <HomefactsSearch cities={index} counties={countyIndex} />
        </section>

        <section style={hf.card}>
          <p style={hf.eyebrow}>What&apos;s in a report</p>
          <h2 style={hf.h2}>Nine modules for every area</h2>
          <p style={{ margin: '10px 0 14px', color: hfColor.muted, fontSize: 14 }}>Built on public-domain and first-party data. Live now; the rest are being wired to their public sources (each named).</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {HF_MODULES.map((m) => (
              <div key={m.id} style={{ background: hfColor.soft, border: `1px solid ${hfColor.line2}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: hfColor.ink }}>{m.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', borderRadius: 5, padding: '2px 6px', color: m.status === 'live' ? '#166534' : '#8a6d3b', background: m.status === 'live' ? '#e7f3ec' : '#fbf1e0', border: `1px solid ${m.status === 'live' ? '#c3dcec' : '#ecd6ac'}` }}>{m.status === 'live' ? 'Live' : 'Soon'}</span>
                </div>
                {m.source && <div style={{ fontSize: 11, color: hfColor.faint, marginTop: 4 }}>{m.source}</div>}
              </div>
            ))}
          </div>
        </section>

        <section style={hf.card}>
          <p style={hf.eyebrow}>Browse</p>
          <h2 style={hf.h2}>Popular cities</h2>
          <div style={{ ...hf.linkGrid, marginTop: 14 }}>
            {popular.map((c) => (
              <a key={`${c.s}/${c.slug}`} href={hfCityPath(c.s, c.slug)} style={{ ...hf.link, fontSize: 14 }}>
                {c.c}, {c.s.toUpperCase()} <span style={{ color: hfColor.muted }}>(~{num(c.pop)})</span>
              </a>
            ))}
          </div>
        </section>

        <FcraFooter />
      </main>
    </div>
  );
}
