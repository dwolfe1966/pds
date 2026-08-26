// Cornerstone guide — "How to find an inmate by name" (SEO WS4). For the common case: only a name,
// no facility. Editorial + funnels to our name-in-state pages. Not in the sitemap yet at write time.
import Link from 'next/link';
import { crumbsJsonLd, faqJsonLd } from '../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../lib/ui';
import { SITE, MAIN } from '../../../lib/site';

export const revalidate = 5184000; // 60d
const PATH = '/guides/find-inmate-by-name';

export const metadata = {
  title: 'How to Find an Inmate by Name — Free Name Search | IDLookup',
  description:
    'How to find an inmate when all you have is a name: search public records across systems, narrow common names, and confirm identity before you act.',
  alternates: { canonical: `${SITE}${PATH}` },
};

const STEPS = [
  { h: '1. You don’t need the facility to start', b: 'A name is enough to begin. A public-records search can surface incarceration history, charges, mugshots, and the facility across many jurisdictions at once — useful precisely when you don’t know which system holds the person.' },
  { h: '2. Add whatever narrows a common name', b: 'For a common name, any extra detail cuts false matches fast: a middle name or initial, an approximate age or date of birth, the last known state or county, and race/sex where a tool allows it. Start broad, then filter.' },
  { h: '3. Search each system by name', b: 'If you know the likely system, search it by name directly: the Federal BOP locator (federal), the state Department of Corrections (prison), or the county sheriff’s jail roster (pre-trial / short sentences). Each accepts a last-name search.' },
  { h: '4. Use VINELink by name for status', b: 'VINELink lets you search by name across most jails and prisons for current custody status, and can alert you to a transfer or release.', link: { href: 'https://www.vinelink.com', label: 'VINELink (nationwide)' } },
  { h: '5. Confirm identity before acting', b: 'Common names produce look-alikes. Corroborate with age/DOB, location, and — where available — a booking or register number before you conclude it’s the right person. A booking record is an allegation, not proof of guilt.' },
];

const NARROW = [
  ['Middle name / initial', 'The single most effective filter for common surnames.'],
  ['Approximate age or DOB', 'Rules out same-name look-alikes across generations.'],
  ['Last known state / county', 'Points you at the right DOC or sheriff’s roster.'],
  ['Race / sex', 'Some official locators let you filter on these.'],
];

const FAQS = [
  { q: 'Can I find an inmate with just a name?', a: 'Yes. Every official locator (federal BOP, state DOC, county jail rosters) supports a name search, and a public-records search can surface incarceration history across systems from a name alone.' },
  { q: 'How do I handle a common name?', a: 'Add any distinguishing detail — middle name/initial, approximate age or date of birth, last known state or county — to cut down look-alike matches. Start broad, then filter.' },
  { q: 'What if there are multiple matches?', a: 'Corroborate before acting: compare age/DOB, location, and identifiers (a booking or BOP register number) to confirm which record is the right person.' },
  { q: 'Is a name-based inmate search free?', a: 'Yes — the official locators are free. Some third-party sites charge for a consolidated multi-system report, but searching each official tool by name costs nothing.' },
];

export default function FindByNameGuide() {
  const crumbs = [{ name: 'Guides', path: '/guides' }, { name: 'Find an Inmate by Name', path: PATH }];
  const jsonLd = [
    crumbsJsonLd(crumbs),
    faqJsonLd(FAQS),
    { '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to Find an Inmate by Name', description: 'Locate someone in custody from a name across public records and official locators.', step: STEPS.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.h.replace(/^\d+\.\s*/, ''), text: s.b })) },
    { '@context': 'https://schema.org', '@type': 'Article', headline: 'How to Find an Inmate by Name', mainEntityOfPage: `${SITE}${PATH}` },
  ];
  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />
      <header style={ui.hero}>
        <p style={ui.eyebrow}>Public Records Guide</p>
        <h1 style={ui.h1}>How to Find an Inmate by Name</h1>
        <p style={ui.lead}>When all you have is a name — no facility, no case number — here’s how to locate someone in custody across the federal, state, and county systems, and how to tell look-alikes apart.</p>
        <a href={`${MAIN}`} target="_blank" rel="noopener" style={ui.cta}>Search by name →</a>
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
        <h2 style={ui.h2}>What narrows a common name</h2>
        <div style={ui.featureGrid}>
          {NARROW.map(([t, d]) => (
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
          <Link href="/guides/are-mugshots-public" style={ui.link}>Are mugshots public record? →</Link>
        </div>
      </section>
      <FcraFooter />
    </main>
  );
}
