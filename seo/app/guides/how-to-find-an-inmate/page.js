// Cornerstone authority guide — "How to find an inmate" (SEO WS4). Editorial, grounded in our real
// first-party roster counts (stateInmateCounts) + linking to the official federal tools and our own
// per-state inmate pages (which carry real records). One flagship page — NOT in the sitemap yet
// (reachable by internal link); measure before scaling to per-state guides. All public-record data.
import Link from 'next/link';
import { stateInmateCounts } from '../../../lib/incarceration.mjs';
import { US_STATES } from '../../../lib/states';
import { statePath } from '../../../lib/ids';
import { crumbsJsonLd, faqJsonLd } from '../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../lib/ui';
import { SITE } from '../../../lib/site';

export const revalidate = 5184000; // 60d

const PATH = '/guides/how-to-find-an-inmate';
const num = (n) => Number(n || 0).toLocaleString('en-US');
const withTimeout = (p, fallback, ms = 1500) =>
  Promise.race([p.catch(() => fallback), new Promise((r) => setTimeout(() => r(fallback), ms))]);

export const metadata = {
  title: 'How to Find an Inmate: Free Inmate Search, State by State | IDLookup',
  description:
    'How to find an inmate for free — federal, state, and county. Use the Federal Bureau of Prisons locator, VINELink, and each state’s DOC inmate search, plus name-based public records.',
  alternates: { canonical: `${SITE}${PATH}` },
};

const STEPS = [
  {
    h: '1. Figure out where they’re held',
    b: 'Custody determines which system to search. Federal convictions → the Federal Bureau of Prisons (BOP). A state prison sentence → that state’s Department of Corrections (DOC). Awaiting trial or a short sentence → the county jail. When you’re unsure, start with the state DOC and the county where the arrest happened.',
  },
  {
    h: '2. Search the Federal Bureau of Prisons (free)',
    b: 'The BOP Inmate Locator covers federal inmates from 1982 to today. Search by name or by BOP register number. It shows the facility, register number, age, and release date.',
    link: { href: 'https://www.bop.gov/inmateloc/', label: 'Federal BOP Inmate Locator' },
  },
  {
    h: '3. Use VINELink for nationwide lookups',
    b: 'VINELink aggregates jail and prison custody status across most states and counties, and can notify you of custody changes (transfer, release). It’s free and a good second stop when you don’t know the exact facility.',
    link: { href: 'https://www.vinelink.com', label: 'VINELink (nationwide)' },
  },
  {
    h: '4. Search the state DOC inmate locator',
    b: 'Every state runs a free offender/inmate search on its Department of Corrections website. The reliable way to find it: search “[State] Department of Corrections inmate search.” Below, each state links to our records for people incarcerated there.',
  },
  {
    h: '5. Check the county jail roster',
    b: 'For pre-trial detainees and short sentences, the person is usually in a county jail, not a state prison — and they won’t appear in the DOC locator. Most sheriff’s offices publish a current “jail roster” or “who’s in jail” page. Search “[County] sheriff jail roster.”',
  },
  {
    h: '6. Search by name across public records',
    b: 'If you only have a name, a public-records search can surface incarceration history, mugshots, charges, and the facility across jurisdictions at once — useful when you don’t know which system holds them.',
  },
];

const WHAT = [
  ['Mugshot / booking photo', 'The intake photo, where the facility publishes it.'],
  ['Charges', 'The booking charges or offenses of record.'],
  ['Facility', 'The jail or prison currently holding the person.'],
  ['Booking date', 'When the person entered custody.'],
  ['Release status', 'In custody, released, or a scheduled release date.'],
  ['Age & identifiers', 'Age, sex, and — in some systems — an inmate/register number.'],
];

const FAQS = [
  { q: 'Is inmate search free?', a: 'Yes. The Federal Bureau of Prisons locator, VINELink, and every state DOC inmate search are free public tools. Some third-party sites charge for a consolidated report, but the official locators cost nothing.' },
  { q: 'How do I find a federal inmate?', a: 'Use the Federal Bureau of Prisons Inmate Locator at bop.gov/inmateloc. Search by name or BOP register number; it covers federal inmates from 1982 onward.' },
  { q: 'Can I find someone in a county jail?', a: 'Often yes — but not through the state DOC locator. County jail detainees appear on the county sheriff’s jail roster (“who’s in jail”) page, not the state prison system. Search “[County] sheriff jail roster.”' },
  { q: 'How current are inmate records?', a: 'Custody status changes constantly (bookings, transfers, releases). Official locators are the most current; aggregated records may lag. Always confirm time-sensitive details against the facility or the official DOC/BOP tool.' },
  { q: 'Can I remove my own record?', a: 'If a record about you appears in our directory and you want it suppressed, you can opt out — we honor removal requests for your own listing.' },
];

export default async function InmateGuide() {
  const counts = await withTimeout(stateInmateCounts(), {});
  const crumbs = [
    { name: 'Guides', path: '/guides' },
    { name: 'How to Find an Inmate', path: PATH },
  ];
  // States we actually have records for, richest first — real coverage, self-gating.
  const covered = Object.keys(US_STATES)
    .map((abbr) => ({ abbr, name: US_STATES[abbr], n: counts[abbr] || 0 }))
    .filter((s) => s.n > 0)
    .sort((a, b) => b.n - a.n);
  const total = covered.reduce((t, s) => t + s.n, 0);

  const jsonLd = [
    crumbsJsonLd(crumbs),
    faqJsonLd(FAQS.map((f) => ({ q: f.q, a: f.a }))),
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'How to Find an Inmate',
      description: 'Locate a federal, state, or county inmate using free official tools and public records.',
      step: STEPS.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.h.replace(/^\d+\.\s*/, ''), text: s.b })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: 'How to Find an Inmate: Free Inmate Search, State by State',
      about: 'Inmate search and incarceration records',
      isPartOf: SITE,
      mainEntityOfPage: `${SITE}${PATH}`,
    },
  ];

  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />

      <header style={ui.hero}>
        <p style={ui.eyebrow}>Public Records Guide</p>
        <h1 style={ui.h1}>How to Find an Inmate</h1>
        <p style={ui.lead}>
          Locating someone who’s incarcerated is free if you know where to look. This guide walks the three
          systems — <strong>federal</strong>, <strong>state</strong>, and <strong>county</strong> — the
          official locators for each, and how to search by name when you don’t know the facility.
          {total > 0 && (
            <> Our own directory carries incarceration records on <strong>{num(total)}</strong> people across{' '}
              <strong>{covered.length}</strong> states.</>
          )}
        </p>
        <a href="#states" style={ui.cta}>Jump to your state</a>
      </header>

      <section style={ui.card}>
        <h2 style={ui.h2}>The fastest way to find an inmate</h2>
        {STEPS.map((s) => (
          <div key={s.h} style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: ui.color.ink }}>{s.h}</h3>
            <p style={{ margin: 0, color: ui.color.body }}>{s.b}</p>
            {s.link && (
              <p style={{ margin: '6px 0 0' }}>
                <a href={s.link.href} target="_blank" rel="noopener nofollow" style={ui.link}>{s.link.label} →</a>
              </p>
            )}
          </div>
        ))}
      </section>

      <section style={ui.card}>
        <h2 style={ui.h2}>What an inmate record shows</h2>
        <div style={ui.featureGrid}>
          {WHAT.map(([t, d]) => (
            <div key={t} style={ui.featureItem}>
              <div>{t}</div>
              <div style={{ fontWeight: 400, color: ui.color.muted, marginTop: 2 }}>{d}</div>
            </div>
          ))}
        </div>
      </section>

      {covered.length > 0 && (
        <section style={ui.card} id="states">
          <h2 style={ui.h2}>Find an inmate by state</h2>
          <p style={{ margin: '0 0 12px', ...ui.muted }}>
            Each state links to the people we have incarceration records for there. For the official search,
            look up “[State] Department of Corrections inmate search.”
          </p>
          <div style={ui.linkGrid}>
            {covered.map((s) => (
              <Link key={s.abbr} href={statePath(s.abbr)} style={ui.link}>
                {s.name} <span style={{ color: ui.color.muted, fontWeight: 400 }}>· {num(s.n)}</span>
              </Link>
            ))}
          </div>
          <p style={ui.source}>Counts reflect first-party incarceration records in our directory; official DOC/BOP tools are authoritative for current custody.</p>
        </section>
      )}

      <section style={ui.card}>
        <h2 style={ui.h2}>Frequently asked questions</h2>
        {FAQS.map((f) => (
          <div key={f.q} style={{ marginBottom: 14 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: ui.color.ink }}>{f.q}</h3>
            <p style={{ margin: 0, color: ui.color.body }}>{f.a}</p>
          </div>
        ))}
      </section>

      <section style={ui.card}>
        <h2 style={ui.h2}>Related guides</h2>
        <div style={ui.linkGrid}>
          <Link href="/guides/how-to-find-a-federal-inmate" style={ui.link}>How to find a federal inmate →</Link>
          <Link href="/guides/county-jail-roster" style={ui.link}>How to find someone in county jail →</Link>
        </div>
      </section>

      <FcraFooter />
    </main>
  );
}
