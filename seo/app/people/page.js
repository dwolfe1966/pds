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
      <p style={{ ...ui.muted, margin: '0 0 20px', fontSize: 15 }}>
        Choose a state to browse the most common names and cities, or search for a specific person.
      </p>
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
