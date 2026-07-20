// /people — the state-first index. Entry point into the directory: pick a state.
import { getStateList } from '../../lib/directory';
import { statePath } from '../../lib/ids';
import { crumbsJsonLd } from '../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../lib/ui';
import { SITE } from '../../lib/site';

export const revalidate = 5184000; // 60d

const num = (n) => Number(n).toLocaleString('en-US');

export const metadata = {
  title: 'People Search by State — Find Anyone in the U.S. | IDLookup',
  description: 'Search for people across all 50 states. Browse the most common names and cities in each state to find addresses, phone numbers, ages, and relatives.',
  alternates: { canonical: `${SITE}/people` },
};

export default function PeopleIndex() {
  const states = getStateList().sort((a, b) => a.name.localeCompare(b.name));
  const crumbs = [{ name: 'People Search', path: '/people' }];

  return (
    <main style={ui.main}>
      <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
      <Breadcrumbs crumbs={crumbs} />
      <h1 style={ui.h1}>People Search by State</h1>
      <p style={{ margin: '0 0 14px', fontSize: 15, lineHeight: 1.6 }}>
        Find people across all 50 states. Browse by state, then by city or name to locate someone by their
        name, age, and location — or start a full search to see addresses, phone numbers, relatives, and public
        records. Our directory also covers <strong>incarceration and inmate records</strong> from state and
        county correctional sources, so you can find people who are or have been incarcerated by name and state.
      </p>
      <section style={{ ...ui.card, marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, fontSize: 17 }}>What you can search</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px 16px', fontSize: 14, color: '#374151' }}>
          <div>📍 Addresses &amp; location history</div>
          <div>📞 Phone numbers</div>
          <div>👥 Relatives &amp; associates</div>
          <div>⚖️ Incarceration &amp; criminal records</div>
          <div>🎂 Age &amp; date of birth</div>
          <div>🏙️ People by city &amp; state</div>
        </div>
      </section>
      <h2 style={{ fontSize: 17, margin: '0 0 8px' }}>Browse people by state</h2>
      <section style={ui.card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 16px' }}>
          {states.map((s) => (
            <a key={s.code} href={statePath(s.code)} style={{ ...ui.link, fontSize: 15 }}>
              {s.name} <span style={ui.muted}>({num(s.pop)})</span>
            </a>
          ))}
        </div>
      </section>
      <FcraFooter />
    </main>
  );
}
