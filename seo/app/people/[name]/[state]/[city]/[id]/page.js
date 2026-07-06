// The leaf profile page — /people/{first}-{last}/{st}/{city}/{id} (plan §2).
// Phase 0's ONE template: everything SEO-critical (visible teaser + all JSON-LD)
// renders server-side into the initial HTML. No client JS is required to see
// any content on this page (teardown §1.7).

import { notFound } from 'next/navigation';
import { getPerson } from '../../../../../../lib/data';
import { personPath, namePath, citySlug } from '../../../../../../lib/ids';
import {
  webPageJsonLd, breadcrumbJsonLd, personJsonLd, buildFaq, faqJsonLd,
  pageTitle, pageDescription, obfuscateStreet,
} from '../../../../../../lib/schema';

export const revalidate = 5184000; // 60d — REVALIDATE_SECONDS (Next needs a literal here)

// The CTA goes DIRECTLY to this person's SUP/teaser page (/search/{extId}), not
// the start of onboarding. Name params let the SUP re-hydrate on a cold link
// (SearchDetailPreviewPage cold-load). Falls back to the name landing only when
// we have no extId (e.g. fixture data).
const SITE = 'https://www.idlookup.ai';
function unlockHref(person) {
  const utm = 'utm_source=seo&utm_medium=organic';
  const enc = encodeURIComponent;
  // Direct to THIS person's SUP. The obf1 extId is ephemeral (re-encrypted on every
  // search), so we DON'T send it — the SUP re-finds the person in a fresh teaser by
  // name + city + first-seen (the same stable key the public id is minted from).
  return `${SITE}/search/${person.id}?fn=${enc(person.firstName)}&ln=${enc(person.lastName)}&st=${(person.state || '').toLowerCase()}&city=${citySlug(person.city)}&fs=${person.onRecordSince || ''}&${utm}`;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) return { title: 'Not found' };
  return {
    title: pageTitle(person),
    description: pageDescription(person),
    alternates: { canonical: `https://www.idlookup.ai${personPath(person)}` },
  };
}

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 24px', marginBottom: 16 };
const gate = { color: '#9ca3af', letterSpacing: 1 };
const cta = {
  display: 'inline-block', background: '#0d5d2f', color: '#fff', padding: '12px 22px',
  borderRadius: 8, fontWeight: 700, textDecoration: 'none',
};

export default async function PersonPage({ params }) {
  const { id } = await params;
  const person = await getPerson(id);
  if (!person) notFound();

  const paths = { person: personPath(person), name: namePath(person) };
  const faqs = buildFaq(person);
  const url = `https://www.idlookup.ai${paths.person}`;
  const jsonLd = [
    webPageJsonLd(person, url),
    breadcrumbJsonLd(person, paths),
    personJsonLd(person, paths),
    faqJsonLd(faqs),
  ];

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>
      {jsonLd.map((block, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
      ))}

      <nav style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
        <a href="/people" style={{ color: '#0d5d2f' }}>People Search</a>
        {' › '}
        <a href={paths.name} style={{ color: '#0d5d2f' }}>{person.firstName} {person.lastName}</a>
        {' › '}
        {person.fullName}
      </nav>

      <h1 style={{ margin: '0 0 4px', fontSize: 30 }}>{person.fullName}, Age {person.age}</h1>
      <p style={{ margin: '0 0 20px', color: '#374151' }}>
        Resides in {person.city}, {person.state}
        {person.aliases.length > 0 && <> · Also known as {person.aliases.join(', ')}</>}
      </p>

      <section style={card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Contact information</h2>
        <p style={{ margin: '6px 0' }}>Current address: {obfuscateStreet(person.streetAddress)}, {person.city}, {person.state} {person.postalCode}</p>
        <p style={{ margin: '6px 0' }}>Phone: <span style={gate}>(•••) •••-••••</span> +{Math.max(person.counts.phones - 1, 0)} more</p>
        <p style={{ margin: '6px 0' }}>Email: <span style={gate}>••••••@•••.com</span> +{Math.max(person.counts.emails - 1, 0)} more</p>
        <p style={{ margin: '10px 0 14px', fontWeight: 700 }}>
          Includes Address({person.counts.addresses}) Phone({person.counts.phones}) Email({person.counts.emails})
        </p>
        <a href={unlockHref(person)} style={cta}>Unlock Full Profile →</a>
      </section>

      {person.categories?.length > 0 && (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Records that may be available</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
            {person.categories.map((c) => (
              <div key={c.key} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{c.label}</span>
                <span style={{ color: '#0d5d2f', fontWeight: 700, fontSize: 13 }}>{c.count > 0 ? `${c.count} 🔒` : 'Available 🔒'}</span>
              </div>
            ))}
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6b7280' }}>Unlock the full report to view criminal, property, financial, and other record details.</p>
        </section>
      )}

      {person.priorCities.length > 0 && (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Location history</h2>
          <p style={{ margin: 0 }}>
            {person.city}, {person.state} (current)
            {person.priorCities.map((c) => ` · ${c.city}, ${c.state}`).join('')}
          </p>
        </section>
      )}

      {person.relatives.length > 0 && (
        <section style={card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Relatives &amp; associates</h2>
          <p style={{ margin: 0 }}>
            {person.relatives.map((r, i) => (
              <span key={r.id}>
                {i > 0 && ' · '}
                <a href={`/people/${r.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} style={{ color: '#0d5d2f' }}>{r.fullName}</a>
              </span>
            ))}
          </p>
        </section>
      )}

      <section style={card}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>{person.firstName} {person.lastName} FAQ</h2>
        {faqs.map((f) => (
          <div key={f.q} style={{ marginBottom: 12 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700 }}>{f.q}</p>
            <p style={{ margin: 0, color: '#374151' }}>{f.a}</p>
          </div>
        ))}
      </section>

      <footer style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, marginTop: 24 }}>
        <p>
          IDLookup.AI is not a consumer reporting agency as defined by the Fair Credit Reporting
          Act (FCRA). Do not use this site to make decisions about employment, tenant screening,
          credit, insurance, or any other purpose covered by the FCRA.
        </p>
        <p>
          <a href="https://www.idlookup.ai/optout" style={{ color: '#0d5d2f' }}>Remove my information</a>
          {' · '}
          <a href="https://www.idlookup.ai/privacy" style={{ color: '#0d5d2f' }}>Privacy Policy</a>
        </p>
      </footer>
    </main>
  );
}
