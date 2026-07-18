// Individual Others-Profile leaf — /people/{state}/{city}/{first-last}/{id} (id = age token).
// Server-rendered teased profile from the captured person corpus (person_profiles). Free-tier facts
// (location history, relatives if teased) render; paid modules are LOCKED with NO real data in the HTML
// (revenue safety) + an unlock CTA into the main funnel. Everything SEO-critical is in the initial HTML.

import { notFound, permanentRedirect } from 'next/navigation';
import { getNameInCity } from '../../../../../../lib/directory';
import { getCapturedPeople, norm } from '../../../../../../lib/search-activity-db.mjs';
import { cityNamePath, cityPath, statePath, ageToken } from '../../../../../../lib/ids';
import { crumbsJsonLd } from '../../../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../../../lib/ui';
import { SITE, MAIN } from '../../../../../../lib/site';

export const revalidate = 5184000; // 60d
// ISR (SEO 2026-07-18): [] + dynamicParams=true → each page is generated on first hit and CACHED for
// `revalidate` instead of live-rendering per request (which returned private/no-store and made every
// Googlebot hit a live Neon render → transient 404s). Flips this route from ƒ Dynamic → ● cached.
export function generateStaticParams() { return []; }

async function resolve(params) {
  const { state, city, name, id } = await params;
  const parts = String(name).split('-').filter(Boolean);
  const firstNorm = norm(parts[0] || '');
  const lastNorm = norm(parts.length > 1 ? parts[parts.length - 1] : '');
  const cityNorm = norm(String(city).replace(/-/g, ' '));
  const rows = await getCapturedPeople({ firstNorm, lastNorm, state: String(state).toUpperCase(), cityNorm, limit: 100 });
  const person = rows.find((r) => ageToken(r.age) === id) || null;
  return { state, city, name, id, person };
}

export async function generateMetadata({ params }) {
  const { person, state, city, name, id } = await resolve(params);
  if (!person) return { title: 'Not found' };
  const loc = [person.city, person.state].filter(Boolean).join(', ');
  return {
    title: `${person.name}${person.age ? `, ${person.age}` : ''} in ${loc} — Profile | IDLookup`,
    description: `Public profile for ${person.name} in ${loc}. Location history, relatives, and available phone, address, and public records.`,
    alternates: { canonical: `${SITE}${cityNamePath(state, city, name)}/${id}` },
  };
}

const LOCKED = [
  { label: 'Phone numbers', key: 'phones' },
  { label: 'Email addresses', key: 'emails' },
  { label: 'Full address history', key: 'addresses' },
  { label: 'Criminal & court records', key: 'court' },
  { label: 'Property records', key: 'property' },
  { label: 'Financial records', key: 'financial' },
];

export default async function ProfilePage({ params }) {
  const { state, city, name, id, person } = await resolve(params);
  if (!person) {
    // ID-CHURN RECOVERY (SEO, 2026-07-18): the id here is an age-token; if the captured person's age
    // shifts (or they drop from the corpus) the token changes → a URL Google indexed 404s. Recover the
    // equity: 308 to the name-in-city hub (which lists current tokens) instead of notFound().
    permanentRedirect(cityNamePath(state, city, name));
  }

  const d = getNameInCity(state, city, name); // optional Census context (proper city/state names)
  const stateName = d?.stateName || person.state;
  const cityName = d?.city || person.city;
  const t = (person.teaser && typeof person.teaser === 'object') ? person.teaser : {};
  const relatives = (Array.isArray(t.relatives) ? t.relatives : [])
    .map((r) => (typeof r === 'string' ? r : (r && (r.name || r.fullName)))).filter(Boolean).slice(0, 12);
  const priorLocations = (Array.isArray(t.locations) ? t.locations : (Array.isArray(t.priorLocations) ? t.priorLocations : []))
    .map((l) => (typeof l === 'string' ? l : (l && (l.city ? [l.city, l.state].filter(Boolean).join(', ') : null)))).filter(Boolean).slice(0, 12);

  const loc = [cityName, person.state].filter(Boolean).join(', ');
  const first = (person.name || '').split(/\s+/)[0] || '';
  const last = (person.name || '').split(/\s+/).slice(-1)[0] || '';
  const unlock = `${MAIN}/name/search-result?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}&state=${encodeURIComponent(person.state || state)}&city=${encodeURIComponent(cityName)}&utm_source=idlookup.me&utm_medium=referral&utm_campaign=people-directory`;

  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: stateName, path: statePath(state) },
    { name: cityName, path: cityPath(state, city) },
    { name: person.name, path: cityNamePath(state, city, name) },
    { name: `${person.name}${person.age ? `, ${person.age}` : ''}`, path: `${cityNamePath(state, city, name)}/${id}` },
  ];
  const personLd = {
    '@context': 'https://schema.org', '@type': 'Person', name: person.name,
    homeLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: cityName, addressRegion: person.state } },
  };

  return (
    <main style={ui.main}>
      <JsonLd blocks={[crumbsJsonLd(crumbs), personLd]} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>{person.name}{person.age ? `, ${person.age}` : ''}</h1>
      <p style={{ margin: '0 0 20px', fontSize: 16, color: '#374151' }}>Resides in {loc}</p>

      <a href={unlock} style={{ ...ui.cta, fontSize: 16 }}>Unlock full profile →</a>

      <section style={{ ...ui.card, marginTop: 20 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>📍 Location history</h2>
        <p style={{ margin: 0 }}>{loc} (current){priorLocations.map((l) => ` · ${l}`).join('')}</p>
      </section>

      {relatives.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>👪 Relatives &amp; associates</h2>
          <p style={{ margin: 0 }}>{relatives.join(' · ')}</p>
        </section>
      )}

      <section style={ui.card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Available in {person.name}&apos;s full report</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {LOCKED.map((m) => (
            <div key={m.key} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{m.label}</span>
              <span style={{ color: '#0d5d2f', fontWeight: 700 }}>🔒</span>
            </div>
          ))}
        </div>
        <p style={{ margin: '12px 0 14px', fontSize: 13, color: '#6b7280' }}>
          Unlock the full report to view phone numbers, addresses, and criminal, property, and financial records.
        </p>
        <a href={unlock} style={{ ...ui.cta, display: 'inline-block' }}>See {person.name}&apos;s full report →</a>
      </section>

      <FcraFooter />
    </main>
  );
}
