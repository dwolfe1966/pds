// Name hub — /people/{first-last}. Aggregates everyone with the name across the
// US, links down to state → city hubs and to individual profiles. Renders on
// demand + ISR; 404s (thin-combo gate) when a name has no people.
import { notFound } from 'next/navigation';
import { getPeopleByName } from '../../../lib/data';
import { nameStatePath, nameCityPath, personPath, nameFromSlug } from '../../../lib/ids';
import { stateName } from '../../../lib/states';
import { collectionJsonLd, crumbsJsonLd } from '../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../lib/ui';

export const revalidate = 5184000; // 60d

const SITE = 'https://www.idlookup.ai';
const FUNNEL = `${SITE}/name/landing/v3`;

export async function generateMetadata({ params }) {
  const { name } = await params;
  const hub = await getPeopleByName(name);
  if (!hub) return { title: 'Not found' };
  const full = `${hub.firstName} ${hub.lastName}`;
  return {
    title: `${full} — ${hub.total} ${hub.total === 1 ? 'Person' : 'People'} Found | IDLookup`,
    description: `Find ${hub.total} ${hub.total === 1 ? 'person' : 'people'} named ${full} in the United States. Browse ${full} by state and city — ages, addresses, phone numbers, and relatives.`,
    alternates: { canonical: `${SITE}/people/${name}` },
  };
}

export default async function NameHub({ params }) {
  const { name } = await params;
  const hub = await getPeopleByName(name);
  if (!hub) notFound();

  const full = `${hub.firstName} ${hub.lastName}`;
  const url = `${SITE}/people/${name}`;
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: full, path: `/people/${name}` },
  ];
  const items = hub.states.map((s) => ({ name: `${full} in ${stateName(s.state)}`, path: nameStatePath(name, s.state) }));
  const jsonLd = [
    collectionJsonLd({ name: `${full} in the United States`, description: `${hub.total} people named ${full}.`, url, items }),
    crumbsJsonLd(crumbs),
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>{full}</h1>
      <p style={{ ...ui.muted, margin: '0 0 20px' }}>
        We found <strong>{hub.total}</strong> {hub.total === 1 ? 'person' : 'people'} named {full} across {hub.states.length} state{hub.states.length === 1 ? '' : 's'} in the United States.
      </p>

      <section style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Browse {full} by location</h2>
        {hub.states.map((s) => (
          <div key={s.state} style={{ marginBottom: 10 }}>
            <a href={nameStatePath(name, s.state)} style={{ ...ui.link, fontWeight: 700 }}>{full} in {stateName(s.state)}</a>
            <span style={ui.muted}> ({s.count})</span>
            <div style={{ fontSize: 14, marginTop: 2 }}>
              {s.cities.map((c, i) => (
                <span key={c}>{i > 0 && ' · '}<a href={nameCityPath(name, s.state, c)} style={ui.link}>{c}</a></span>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>People named {full}</h2>
        {hub.people.map((p) => (
          <p key={p.id} style={{ margin: '6px 0' }}>
            <a href={personPath(p)} style={ui.link}>{p.fullName}, {p.age}</a>
            <span style={ui.muted}> — {p.city}, {p.state}</span>
          </p>
        ))}
      </section>

      <a href={`${FUNNEL}?utm_source=seo&utm_medium=organic&q=${encodeURIComponent(full)}`} style={ui.cta}>Search {full} →</a>

      <FcraFooter />
    </main>
  );
}
