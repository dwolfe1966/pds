// Cornerstone guide — "How to find a federal inmate" (SEO WS4). Editorial authority content on the
// federal (BOP) system, distinct from the state/county guides. Not in the sitemap yet (owner).
import Link from 'next/link';
import { crumbsJsonLd, faqJsonLd } from '../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../lib/ui';
import { SITE } from '../../../lib/site';

export const revalidate = 5184000; // 60d
const PATH = '/guides/how-to-find-a-federal-inmate';

export const metadata = {
  title: 'How to Find a Federal Inmate — BOP Inmate Locator Guide | IDLookup',
  description:
    'How to find a federal inmate for free with the Federal Bureau of Prisons (BOP) Inmate Locator — search by name or register number, read the results, and contact a federal inmate.',
  alternates: { canonical: `${SITE}${PATH}` },
};

const STEPS = [
  { h: '1. Confirm it’s a federal case', b: 'Federal inmates were convicted of a federal crime and sentenced in a U.S. District Court — think drug trafficking, wire fraud, immigration, or firearms offenses. If the case was in state court, the person is in a state prison or county jail instead, and you’ll search those systems, not the BOP.' },
  { h: '2. Use the BOP Inmate Locator', b: 'The Federal Bureau of Prisons runs a free locator covering federal inmates from 1982 to today. Search by first and last name (add race/age/sex to narrow results) or, if you have it, by BOP register number for an exact match.', link: { href: 'https://www.bop.gov/inmateloc/', label: 'Federal BOP Inmate Locator' } },
  { h: '3. Read the BOP register number', b: 'Every federal inmate has a unique register number in the format XXXXX-XXX (e.g., 12345-678). It stays with the person across transfers, so it’s the most reliable way to track someone and is required for mail and many services.' },
  { h: '4. Find the facility and how to contact them', b: 'The locator shows the current facility. From the BOP facility page you can find the mailing address, phone number, and visiting rules. Federal inmates can’t receive calls, but you can send mail (follow the facility’s exact addressing format) or set up a phone/visiting arrangement.' },
  { h: '5. If they’re not federal, check state or county', b: 'No result in the BOP locator usually means the case isn’t federal. Search the state Department of Corrections for a prison sentence, or the county jail roster for someone awaiting trial.' },
];

const WHAT = [
  ['Register number', 'The permanent XXXXX-XXX federal ID — key for mail and tracking.'],
  ['Facility', 'The federal prison or facility currently holding the inmate.'],
  ['Age & race', 'Identifiers to disambiguate common names.'],
  ['Release date', 'The projected release date, when set.'],
  ['Status', 'In BOP custody, released, or in a community program.'],
];

const FAQS = [
  { q: 'Are federal inmate records free?', a: 'Yes. The Federal Bureau of Prisons Inmate Locator at bop.gov/inmateloc is free and official. You never have to pay to look up a federal inmate.' },
  { q: 'What is a BOP register number?', a: 'A unique federal inmate ID in the format XXXXX-XXX. It follows the inmate across facility transfers and is required for mail and most services — the most reliable identifier to search by.' },
  { q: 'Can I find someone released from federal prison?', a: 'Often yes. The BOP locator includes federal inmates released back to 1982, so you can confirm a past federal incarceration and its release date.' },
  { q: 'How do I contact a federal inmate?', a: 'Federal inmates can’t receive incoming calls, but you can write to them (use the facility’s required addressing format with the register number) or arrange approved phone calls and visits through the facility.' },
  { q: 'How do I know if a case is federal vs. state?', a: 'Federal cases are prosecuted in U.S. District Court for federal crimes; state cases are in state court. If the BOP locator has no record, the person is likely in a state prison (DOC) or county jail instead.' },
];

export default function FederalGuide() {
  const crumbs = [{ name: 'Guides', path: '/guides' }, { name: 'How to Find a Federal Inmate', path: PATH }];
  const jsonLd = [
    crumbsJsonLd(crumbs),
    faqJsonLd(FAQS),
    { '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to Find a Federal Inmate', description: 'Locate a federal inmate free with the BOP Inmate Locator.', step: STEPS.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.h.replace(/^\d+\.\s*/, ''), text: s.b })) },
    { '@context': 'https://schema.org', '@type': 'Article', headline: 'How to Find a Federal Inmate', mainEntityOfPage: `${SITE}${PATH}` },
  ];
  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />
      <header style={ui.hero}>
        <p style={ui.eyebrow}>Public Records Guide</p>
        <h1 style={ui.h1}>How to Find a Federal Inmate</h1>
        <p style={ui.lead}>Federal inmates are held in the Bureau of Prisons system — separate from state prisons and county jails. Here’s how to locate one for free, read the results, and make contact.</p>
        <a href="https://www.bop.gov/inmateloc/" target="_blank" rel="noopener nofollow" style={ui.cta}>Open the BOP Locator →</a>
      </header>
      <section style={ui.card}>
        <h2 style={ui.h2}>Step by step</h2>
        {STEPS.map((s) => (
          <div key={s.h} style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: ui.color.ink }}>{s.h}</h3>
            <p style={{ margin: 0, color: ui.color.body }}>{s.b}</p>
            {s.link && <p style={{ margin: '6px 0 0' }}><a href={s.link.href} target="_blank" rel="noopener nofollow" style={ui.link}>{s.link.label} →</a></p>}
          </div>
        ))}
      </section>
      <section style={ui.card}>
        <h2 style={ui.h2}>What the BOP locator shows</h2>
        <div style={ui.featureGrid}>
          {WHAT.map(([t, d]) => (
            <div key={t} style={ui.featureItem}><div>{t}</div><div style={{ fontWeight: 400, color: ui.color.muted, marginTop: 2 }}>{d}</div></div>
          ))}
        </div>
      </section>
      <section style={ui.card}>
        <h2 style={ui.h2}>Frequently asked questions</h2>
        {FAQS.map((f) => (
          <div key={f.q} style={{ marginBottom: 14 }}><h3 style={{ margin: '0 0 4px', fontSize: 16, color: ui.color.ink }}>{f.q}</h3><p style={{ margin: 0, color: ui.color.body }}>{f.a}</p></div>
        ))}
      </section>
      <section style={ui.card}>
        <h2 style={ui.h2}>Related guides</h2>
        <div style={ui.linkGrid}>
          <Link href="/guides/how-to-find-an-inmate" style={ui.link}>How to find an inmate (all systems) →</Link>
          <Link href="/guides/county-jail-roster" style={ui.link}>How to find someone in county jail →</Link>
        </div>
      </section>
      <FcraFooter />
    </main>
  );
}
