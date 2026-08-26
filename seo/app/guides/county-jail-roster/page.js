// Cornerstone guide — "How to find someone in county jail / county jail roster" (SEO WS4). Covers the
// jail (pre-trial) system, distinct from the state DOC + federal BOP guides. Not in the sitemap yet.
import Link from 'next/link';
import { crumbsJsonLd, faqJsonLd } from '../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../lib/ui';
import { SITE } from '../../../lib/site';

export const revalidate = 5184000; // 60d
const PATH = '/guides/county-jail-roster';

export const metadata = {
  title: 'How to Find Someone in County Jail — Jail Roster Guide | IDLookup',
  description:
    'How to find someone in county jail: search the sheriff’s jail roster, why detainees aren’t in the prison locators, booking and bond details, and VINELink for custody status.',
  alternates: { canonical: `${SITE}${PATH}` },
};

const STEPS = [
  { h: '1. Know the difference: jail vs. prison', b: 'County jails hold people awaiting trial, serving short sentences (typically under a year), or being held on a warrant or transfer. State prisons (DOC) and the federal BOP hold people already convicted of longer sentences. Someone booked yesterday is almost always in a county jail — and won’t appear in the state or federal prison locators.' },
  { h: '2. Find the county sheriff’s jail roster', b: 'Most sheriff’s offices publish a live “jail roster,” “inmate roster,” or “who’s in jail” page for their county. The reliable way to find it: search “[County] sheriff jail roster” or “[County] inmate search.” These are free and updated frequently.' },
  { h: '3. Search by name and read the booking', b: 'Search the roster by last name. A booking record typically shows the booking photo, charges, booking date, bond/bail amount, and sometimes a court date. Note the booking number — it’s the jail’s unique ID for that stay.' },
  { h: '4. Use VINELink for custody status and alerts', b: 'When you can’t find the right county, or want to be notified of a release or transfer, VINELink aggregates jail custody status across most counties and can send free notifications.', link: { href: 'https://www.vinelink.com', label: 'VINELink (nationwide)' } },
  { h: '5. If they’ve been sentenced, check DOC or BOP', b: 'Once a person is convicted and sentenced to prison, they move out of the county jail and into the state DOC or the federal system — and drop off the jail roster. Search the state Department of Corrections or the BOP locator instead.' },
];

const WHAT = [
  ['Booking photo', 'The intake (booking) photo, where the county publishes it.'],
  ['Charges', 'The booking charges — note these are allegations, not convictions.'],
  ['Bond / bail', 'The amount set for release, when listed.'],
  ['Booking date & number', 'When the person was booked and the jail’s ID for that stay.'],
  ['Court date', 'The next scheduled appearance, in some rosters.'],
];

const FAQS = [
  { q: 'What’s the difference between jail and prison?', a: 'Jail is county-run and holds people awaiting trial or serving short sentences (usually under a year). Prison is state- or federally-run for longer, post-conviction sentences. A newly-arrested person is in county jail, not prison.' },
  { q: 'How do I find a county jail roster?', a: 'Search “[County] sheriff jail roster” or “[County] inmate search.” Most sheriff’s offices publish a free, frequently-updated roster you can search by name.' },
  { q: 'Why isn’t someone in the state DOC locator?', a: 'Because they haven’t been sentenced to prison yet. Pre-trial detainees and short-sentence inmates are in the county jail and appear on the sheriff’s roster — not the DOC or BOP prison locators.' },
  { q: 'Can I see the bond or bail amount?', a: 'Often yes — many county jail rosters list the bond/bail amount alongside the charges and booking date, though it varies by county.' },
  { q: 'How current are county jail rosters?', a: 'Jail populations turn over fast (new bookings and releases daily). Official sheriff rosters are the most current; always confirm time-sensitive details with the facility.' },
];

export default function CountyJailGuide() {
  const crumbs = [{ name: 'Guides', path: '/guides' }, { name: 'County Jail Roster', path: PATH }];
  const jsonLd = [
    crumbsJsonLd(crumbs),
    faqJsonLd(FAQS),
    { '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to Find Someone in County Jail', description: 'Search a county sheriff’s jail roster for someone in custody.', step: STEPS.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.h.replace(/^\d+\.\s*/, ''), text: s.b })) },
    { '@context': 'https://schema.org', '@type': 'Article', headline: 'How to Find Someone in County Jail', mainEntityOfPage: `${SITE}${PATH}` },
  ];
  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />
      <header style={ui.hero}>
        <p style={ui.eyebrow}>Public Records Guide</p>
        <h1 style={ui.h1}>How to Find Someone in County Jail</h1>
        <p style={ui.lead}>People awaiting trial or serving short sentences are in a <strong>county jail</strong>, not a state or federal prison — so they won’t show up in the DOC or BOP locators. Here’s how to search the right place: the sheriff’s jail roster.</p>
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
        <h2 style={ui.h2}>What a jail roster shows</h2>
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
          <Link href="/guides/how-to-find-a-federal-inmate" style={ui.link}>How to find a federal inmate →</Link>
        </div>
      </section>
      <FcraFooter />
    </main>
  );
}
