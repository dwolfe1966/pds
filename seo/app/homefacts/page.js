// HomeFacts landing — /homefacts. Search a city / ZIP / address → an area profile (city · county · zip · address).
// Built on the same public-data engine as the /people directory. Server component; search is the one client island.
import STATE_SLICE from '../../data/state-slice.json';
import { hf, hfColor, BRAND, HfHeader, TopoMotif } from '../../lib/hf';
import { FcraFooter, JsonLd } from '../../lib/ui';
import { SITE } from '../../lib/site';
import { HF_MODULES, hfCityPath, getCounties } from '../../lib/homefacts';
import { HfIcon } from '../../lib/HfIcon';
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
  const states = Object.keys(STATE_SLICE.states).map((lc) => ({ lc, name: STATE_SLICE.states[lc].name })).sort((a, b) => a.name.localeCompare(b.name));
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
          <p style={hf.eyebrow}>What makes it different</p>
          <h2 style={hf.h2}>The place — and the people in it.</h2>
          <p style={{ margin: '10px 0 18px', color: hfColor.muted, fontSize: 14, maxWidth: '66ch' }}>
            Most neighborhood sites tell you about the <em>place</em>. HomeFacts also connects you to the <em>people</em> —
            so an address becomes an answer.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 14, alignItems: 'stretch' }}>
            <div style={{ background: hfColor.accentSoft, border: `1px solid ${hfColor.accentLine}`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: hfColor.accent, marginBottom: 8 }}>
                <HfIcon name="neighborhood" size={15} color={hfColor.accent} /> The “Where”
              </div>
              <div style={{ fontSize: 15, fontWeight: 750, color: hfColor.ink, marginBottom: 4 }}>Know the place</div>
              <p style={{ margin: 0, fontSize: 13, color: hfColor.body, lineHeight: 1.55 }}>Property values, crime, schools, environmental &amp; disaster risk, and the sex-offender registry — for any city, county, ZIP, or address.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: hfColor.muted, fontSize: 22, fontWeight: 800 }}>
              <span style={{ writingMode: 'horizontal-tb' }}>+</span>
            </div>
            <div style={{ background: hfColor.soft, border: `1px solid ${hfColor.line}`, borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: hfColor.muted, marginBottom: 8 }}>
                <HfIcon name="names" size={15} color={hfColor.muted} /> The “Who”
              </div>
              <div style={{ fontSize: 15, fontWeight: 750, color: hfColor.ink, marginBottom: 4 }}>Know who lives there</div>
              <p style={{ margin: 0, fontSize: 13, color: hfColor.body, lineHeight: 1.55 }}>Every area links to the people connected to it — popular names and public incarceration records — that lead straight into a full people search.</p>
            </div>
          </div>
        </section>

        <section style={hf.card}>
          <p style={hf.eyebrow}>What&apos;s in a report</p>
          <h2 style={hf.h2}>Nine modules for every area</h2>
          <p style={{ margin: '10px 0 16px', color: hfColor.muted, fontSize: 14 }}>Built on public-domain and first-party data — each sourced, never estimated.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 }}>
            {HF_MODULES.map((m) => (
              <div key={m.id} style={{ position: 'relative', background: hfColor.surface, border: `1px solid ${hfColor.line}`, borderRadius: 12, padding: '15px 16px' }}>
                <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 9.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', borderRadius: 999, padding: '2px 7px', color: m.status === 'live' ? '#166534' : '#8a6d3b', background: m.status === 'live' ? '#e7f3ec' : '#fbf1e0', border: `1px solid ${m.status === 'live' ? '#c3dcec' : '#ecd6ac'}` }}>{m.status === 'live' ? 'Live' : 'Soon'}</span>
                <span style={{ display: 'flex', width: 36, height: 36, borderRadius: 10, background: hfColor.accentSoft, border: `1px solid ${hfColor.accentLine}`, color: hfColor.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <HfIcon name={m.id} size={19} />
                </span>
                <div style={{ fontSize: 14.5, fontWeight: 750, color: hfColor.ink }}>{m.label}</div>
                {m.source && <div style={{ fontSize: 11, color: hfColor.faint, marginTop: 3, lineHeight: 1.4 }}>{m.source}</div>}
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
          <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${hfColor.line2}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: hfColor.body, marginBottom: 10 }}>Browse by state</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {states.map((s) => (
                <a key={s.lc} href={`/homefacts/${s.lc}`} style={{ fontSize: 12.5, fontWeight: 600, color: hfColor.accent, textDecoration: 'none', background: hfColor.accentSoft, border: `1px solid ${hfColor.accentLine}`, borderRadius: 999, padding: '5px 11px' }}>{s.name}</a>
              ))}
            </div>
          </div>
        </section>

        <FcraFooter />
      </main>
    </div>
  );
}
