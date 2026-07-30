// HomeFacts landing — /homefacts. Search a city / ZIP / address → an area profile (city · county · zip · address).
// Built on the same public-data engine as the /people directory. Server component; search is the one client island.
import STATE_SLICE from '../../data/state-slice.json';
import { hf, hfColor, BRAND, HfHeader } from '../../lib/hf';
import { FcraFooter, JsonLd } from '../../lib/ui';
import { SITE } from '../../lib/site';
import { HF_MODULES, hfCityPath, getCounties } from '../../lib/homefacts';
import { HfIcon } from '../../lib/HfIcon';
import HomefactsSearch from './HomefactsSearch';

// Subtle topographic-contour motif for the hero — inline SVG (no external request), evokes a map without a
// raster image. White strokes at low opacity over the blue gradient.
function TopoMotif() {
  const rings = [0, 1, 2, 3, 4, 5];
  return (
    <svg aria-hidden="true" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.14, pointerEvents: 'none' }}>
      <g fill="none" stroke="#fff" strokeWidth="1.1">
        {rings.map((i) => (
          <path key={`a${i}`} d={`M ${-40 + i * 6} 60 Q 120 ${10 + i * 14} 250 ${70 + i * 8} T 460 ${40 + i * 10}`} />
        ))}
        {rings.map((i) => (
          <path key={`b${i}`} d={`M ${-20 + i * 8} 210 Q 140 ${150 - i * 10} 300 ${200 - i * 12} T 470 ${170 - i * 8}`} />
        ))}
      </g>
      <g fill="#fff" opacity="0.5">
        <circle cx="300" cy="70" r="3" /><circle cx="110" cy="150" r="3" /><circle cx="360" cy="150" r="2.5" />
      </g>
    </svg>
  );
}

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

        <section style={{ position: 'relative', overflow: 'hidden', background: `linear-gradient(140deg, ${BRAND.accent} 0%, ${BRAND.accentDark} 100%)`, color: '#fff', borderRadius: 18, padding: 'clamp(32px,5vw,58px) clamp(20px,4vw,40px)', textAlign: 'center', marginBottom: 20 }}>
          <TopoMotif />
          <div style={{ position: 'relative' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, margin: '0 0 14px', fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#fff', background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 999, padding: '6px 13px' }}>
              <HfIcon name="neighborhood" size={15} color="#fff" /> Neighborhood reports
            </span>
            <h1 style={{ margin: '0 0 12px', fontSize: 'clamp(29px,4.8vw,44px)', fontWeight: 850, letterSpacing: '-.03em', lineHeight: 1.06, textWrap: 'balance' }}>Know any neighborhood — and who&apos;s in it.</h1>
            <p style={{ margin: '0 auto 24px', fontSize: 'clamp(15px,1.8vw,17px)', lineHeight: 1.6, maxWidth: '56ch', opacity: 0.93 }}>
              Demographics, property values, schools, crime, natural-disaster &amp; environmental risk, and the
              registered sex-offender registry — for any U.S. city, county, ZIP, or address. Free.
            </p>
            <HomefactsSearch cities={index} counties={countyIndex} />
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 10px', margin: '20px auto 0', maxWidth: 560 }}>
              {[['location', 'Cities'], ['neighborhood', 'Counties'], ['summary', 'ZIP codes'], ['property', 'Addresses']].map(([ic, label]) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 650, color: '#fff', background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 999, padding: '5px 12px' }}>
                  <HfIcon name={ic} size={14} color="#fff" /> {label}
                </span>
              ))}
            </div>
            <p style={{ margin: '16px 0 0', fontSize: 11.5, letterSpacing: '.02em', opacity: 0.7 }}>
              Sourced from U.S. Census · FBI · FEMA · EPA · NCES + first-party records
            </p>
          </div>
        </section>

        <section style={hf.card}>
          <p style={hf.eyebrow}>What&apos;s in a report</p>
          <h2 style={hf.h2}>Nine modules for every area</h2>
          <p style={{ margin: '10px 0 14px', color: hfColor.muted, fontSize: 14 }}>Built on public-domain and first-party data. Live now; the rest are being wired to their public sources (each named).</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {HF_MODULES.map((m) => (
              <div key={m.id} style={{ background: hfColor.soft, border: `1px solid ${hfColor.line2}`, borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: hfColor.ink }}>
                    <HfIcon name={m.id} size={17} color={hfColor.accent} /> {m.label}
                  </span>
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
