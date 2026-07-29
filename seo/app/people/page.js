// /people — the state-first index. Entry point into the directory: pick a state.
import { getStateList } from '../../lib/directory';
import { statePath } from '../../lib/ids';
import { crumbsJsonLd } from '../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../lib/ui';
import { SITE } from '../../lib/site';

export const revalidate = 5184000; // 60d

const num = (n) => Number(n).toLocaleString('en-US');
const features = [
  'Addresses and location history',
  'Phone numbers',
  'Relatives and associates',
  'Incarceration and criminal records',
  'Age and date of birth',
  'People by city and state',
];

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
      <section style={ui.hero}>
        <p style={ui.eyebrow}>State directory</p>
        <h1 style={ui.h1}>People Search by State</h1>
        <p style={ui.lead}>
          Find people across all 50 states. Browse by state, then by city or name to locate someone by their
          name, age, and location — or start a full search to see addresses, phone numbers, relatives, and public
          records. Our directory also covers <strong>incarceration and inmate records</strong> from state and
          county correctional sources, so you can find people who are or have been incarcerated by name and state.
        </p>
      </section>
      <section style={{ ...ui.card, marginBottom: 16 }}>
        <h2 style={ui.h2}>What you can search</h2>
        <div style={ui.featureGrid}>
          {features.map((feature) => <div key={feature} style={ui.featureItem}>{feature}</div>)}
        </div>
      </section>
      <section style={ui.card}>
        <h2 style={ui.h2}>Browse people by state</h2>
        <div style={ui.linkGrid}>
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
