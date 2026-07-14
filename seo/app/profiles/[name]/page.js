// Real-profile name hub — /profiles/{first-last}. Aggregates the actual people we hold for a
// name (state → city → person). When we have no profiles for the name it renders a LENIENT hub
// (name facts + search CTA) instead of 404ing — this recovers legacy /people/<name> URLs that
// Google indexed (redirected here) and bare /profiles/<name> that lost their data.
import { notFound } from 'next/navigation';
import { getPeopleByName } from '../../../lib/data';
import { nameStatePath, nameCityPath, personPath, nameFromSlug } from '../../../lib/ids';
import { stateName } from '../../../lib/states';
import { getFirstNameFacts, getSurnameFacts } from '../../../lib/facts';
import { NAME_SLUG_RE } from '../../../lib/name-in-state';
import { collectionJsonLd, crumbsJsonLd } from '../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../lib/ui';
import { SITE, MAIN } from '../../../lib/site';

export const revalidate = 5184000; // 60d

const FUNNEL = `${MAIN}/name/landing/v2`;

export async function generateMetadata({ params }) {
  const { name } = await params;
  const hub = await getPeopleByName(name);
  if (!hub) {
    if (!NAME_SLUG_RE.test(name)) return { title: 'Not found' };
    const { display } = nameFromSlug(name);
    return {
      title: `${display} — Search Public Records | IDLookup`,
      description: `Search for ${display} in the United States — addresses, phone numbers, ages, and relatives from public records.`,
      alternates: { canonical: `${SITE}/profiles/${name}` },
    };
  }
  const full = `${hub.firstName} ${hub.lastName}`;
  return {
    title: `${full} — ${hub.total} ${hub.total === 1 ? 'Person' : 'People'} Found | IDLookup`,
    description: `Find ${hub.total} ${hub.total === 1 ? 'person' : 'people'} named ${full} in the United States. Browse ${full} by state and city — ages, addresses, phone numbers, and relatives.`,
    alternates: { canonical: `${SITE}/profiles/${name}` },
  };
}

const stat = {
  wrap: { display: 'flex', gap: 12, flexWrap: 'wrap', margin: '16px 0' },
  card: { flex: '1 1 200px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', fontWeight: 700 },
  big: { fontSize: 24, fontWeight: 800, color: '#0d5d2f', margin: '2px 0 4px' },
  sub: { fontSize: 13, color: '#374151' },
};

function LeanNameHub({ name }) {
  const { firstName, lastName, display } = nameFromSlug(name);
  const ff = getFirstNameFacts(firstName);
  const lf = getSurnameFacts(lastName);
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: display, path: `/profiles/${name}` },
  ];
  return (
    <main style={ui.main}>
      <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
      <Breadcrumbs crumbs={crumbs} />
      <h1 style={ui.h1}>{display}</h1>
      <p style={{ margin: '0 0 18px', fontSize: 17, lineHeight: 1.6 }}>
        Looking for {display}? Search public records across the United States to find addresses, phone numbers, ages, and relatives.
      </p>
      <a href={`${FUNNEL}?utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory&q=${encodeURIComponent(display)}`} style={{ ...ui.cta, fontSize: 16 }}>Search {display} →</a>
      {(ff || lf) && (
        <div style={stat.wrap}>
          {firstName && (
            <div style={stat.card}>
              <div style={stat.label}>First name</div>
              <div style={stat.big}>{firstName}</div>
              <div style={stat.sub}>{ff?.rank ? `#${Number(ff.rank).toLocaleString('en-US')} most common first name in the U.S.` : 'A U.S. given name'}{ff?.gender === 'female' ? ' · Female' : ff?.gender === 'male' ? ' · Male' : ''}</div>
            </div>
          )}
          {lastName && (
            <div style={stat.card}>
              <div style={stat.label}>Surname</div>
              <div style={stat.big}>{lastName}</div>
              <div style={stat.sub}>{lf?.rank ? `#${Number(lf.rank).toLocaleString('en-US')} most common surname in the U.S.` : 'A U.S. surname'}</div>
            </div>
          )}
        </div>
      )}
      <FcraFooter />
    </main>
  );
}

export default async function NameHub({ params }) {
  const { name } = await params;
  const hub = await getPeopleByName(name);
  if (!hub) {
    if (NAME_SLUG_RE.test(name)) return <LeanNameHub name={name} />;
    notFound();
  }

  const full = `${hub.firstName} ${hub.lastName}`;
  const url = `${SITE}/profiles/${name}`;
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: full, path: `/profiles/${name}` },
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
      <a href={`${FUNNEL}?utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory&q=${encodeURIComponent(full)}`} style={ui.cta}>Search {full} →</a>
      <FcraFooter />
    </main>
  );
}
