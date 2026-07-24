// Home ( / ) — the site's root page. MUST be real, indexable content (200), NOT a redirect: Bing + GSC
// flagged the old `/` → `/people` 307 as un-indexable (2026-07-24). This is a distinct HUB (intro + top
// states + verticals) that links INTO the /people directory — not a duplicate of it.
import { getStateList } from '../lib/directory';
import { statePath } from '../lib/ids';
import { ui, FcraFooter, JsonLd } from '../lib/ui';
import { orgJsonLd } from '../lib/schema';
import { SITE } from '../lib/site';

export const revalidate = 5184000; // 60d

const num = (n) => Number(n).toLocaleString('en-US');

export const metadata = {
  title: 'IDLookup — People Search, Background & Public Records',
  description: 'Search public records for people across all 50 states — addresses, phone numbers, relatives, age, and criminal & incarceration records. Start with a name and state.',
  alternates: { canonical: `${SITE}/` },
};

export default function Home() {
  const states = getStateList();
  const topStates = [...states].sort((a, b) => b.pop - a.pop).slice(0, 12);

  return (
    <main style={ui.main}>
      <JsonLd blocks={[orgJsonLd()]} />
      <h1 style={ui.h1}>People Search &amp; Public Records</h1>
      <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.6 }}>
        IDLookup is a free directory to <strong>find people across all 50 U.S. states</strong>. Search by name
        and state to locate someone by their age and location, then see addresses, phone numbers, relatives, and
        public records. Our directory also covers <strong>incarceration and inmate records</strong> from state
        and county correctional sources, so you can find people who are or have been incarcerated by name and
        state.
      </p>

      <section style={{ ...ui.card, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>What you can find</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px 16px', fontSize: 14, color: '#374151' }}>
          <div>📍 Addresses &amp; location history</div>
          <div>📞 Phone numbers</div>
          <div>👥 Relatives &amp; associates</div>
          <div>⚖️ Incarceration &amp; criminal records</div>
          <div>🎂 Age &amp; date of birth</div>
          <div>🏙️ People by city &amp; state</div>
        </div>
      </section>

      <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Popular states</h2>
      <section style={{ ...ui.card, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 16px' }}>
          {topStates.map((s) => (
            <a key={s.code} href={statePath(s.code)} style={{ ...ui.link, fontSize: 15 }}>
              People in {s.name} <span style={ui.muted}>({num(s.pop)})</span>
            </a>
          ))}
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 15 }}>
          <a href="/people" style={ui.link}>Browse all 50 states →</a>
        </p>
      </section>

      <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Records &amp; directories</h2>
      <section style={ui.card}>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, lineHeight: 1.9 }}>
          <li><a href="/people" style={ui.link}>People search by state</a> — browse the most common names and cities in every state.</li>
          <li><a href={statePath('ca')} style={ui.link}>Incarceration &amp; inmate records</a> — find people in state and county correctional records by name and state.</li>
        </ul>
      </section>

      <FcraFooter />
    </main>
  );
}
