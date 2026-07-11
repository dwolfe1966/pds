// State hub — /profiles/{first-last}/{state}. The name's people in one state,
// links down to city hubs and profiles. On demand + ISR; 404s when empty.
import { notFound } from 'next/navigation';
import { getPeopleByNameState } from '../../../../lib/data';
import { nameCityPath, personPath } from '../../../../lib/ids';
import { stateName } from '../../../../lib/states';
import { collectionJsonLd, crumbsJsonLd } from '../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../lib/ui';
import { SITE, MAIN } from '../../../../lib/site';

export const revalidate = 5184000; // 60d

const FUNNEL = `${MAIN}/name/landing/v2`;

export async function generateMetadata({ params }) {
  const { name, state } = await params;
  const hub = await getPeopleByNameState(name, state);
  if (!hub) return { title: 'Not found' };
  const full = `${hub.firstName} ${hub.lastName}`;
  return {
    title: `${full} in ${stateName(hub.state)} — ${hub.people.length} Found | IDLookup`,
    description: `${hub.people.length} people named ${full} in ${stateName(hub.state)}. Browse by city — ages, addresses, phones, and relatives.`,
    alternates: { canonical: `${SITE}/profiles/${name}/${state.toLowerCase()}` },
  };
}

export default async function StateHub({ params }) {
  const { name, state } = await params;
  const hub = await getPeopleByNameState(name, state);
  if (!hub) notFound();

  const full = `${hub.firstName} ${hub.lastName}`;
  const st = stateName(hub.state);
  const url = `${SITE}/profiles/${name}/${state.toLowerCase()}`;
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: full, path: `/profiles/${name}` },
    { name: st, path: `/profiles/${name}/${state.toLowerCase()}` },
  ];
  const items = hub.cities.map((c) => ({ name: `${full} in ${c.city}, ${hub.state}`, path: nameCityPath(name, hub.state, c.city) }));
  const jsonLd = [
    collectionJsonLd({ name: `${full} in ${st}`, description: `${hub.people.length} people named ${full} in ${st}.`, url, items }),
    crumbsJsonLd(crumbs),
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>{full} in {st}</h1>
      <p style={{ ...ui.muted, margin: '0 0 20px' }}>
        <strong>{hub.people.length}</strong> {hub.people.length === 1 ? 'person' : 'people'} named {full} {hub.cities.length > 1 ? `across ${hub.cities.length} cities in ` : 'in '}{st}.
      </p>

      <section style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{full} by city in {st}</h2>
        {hub.cities.map((c) => (
          <p key={c.city} style={{ margin: '6px 0' }}>
            <a href={nameCityPath(name, hub.state, c.city)} style={ui.link}>{full} in {c.city}, {hub.state}</a>
            <span style={ui.muted}> ({c.count})</span>
          </p>
        ))}
      </section>

      <section style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>People named {full} in {st}</h2>
        {hub.people.map((p) => (
          <p key={p.id} style={{ margin: '6px 0' }}>
            <a href={personPath(p)} style={ui.link}>{p.fullName}, {p.age}</a>
            <span style={ui.muted}> — {p.city}, {p.state}</span>
          </p>
        ))}
      </section>

      <a href={`${FUNNEL}?utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory&q=${encodeURIComponent(full)}`} style={ui.cta}>Search {full} →</a>

      <FcraFooter />
    </main>
  );
}
