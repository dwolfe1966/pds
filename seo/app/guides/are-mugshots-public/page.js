// Cornerstone guide — "Are mugshots public record?" (SEO WS4). Explainer on mugshot access + the growing
// legal restrictions on publication. Accurate + hedged (laws vary by state). Not in the sitemap yet at write.
import Link from 'next/link';
import { crumbsJsonLd, faqJsonLd } from '../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../lib/ui';
import { SITE } from '../../../lib/site';

export const revalidate = 5184000; // 60d
const PATH = '/guides/are-mugshots-public';

export const metadata = {
  title: 'Are Mugshots Public Record? How to Find (or Remove) a Mugshot | IDLookup',
  description:
    'Are mugshots public record? Generally yes — but publication is increasingly restricted by state. What a mugshot is, how to find one, why it isn’t proof of guilt, and how removal works.',
  alternates: { canonical: `${SITE}${PATH}` },
};

const POINTS = [
  { h: 'What a mugshot is', b: 'A mugshot is the booking photo taken when someone is processed into a jail after an arrest. It documents that an arrest happened — not that the person was charged, convicted, or is guilty of anything.' },
  { h: 'Are they public record?', b: 'In most states, arrest and booking records — often including the mugshot — are public record. But it varies and is changing: a growing number of states restrict the commercial publication of mugshots (and require sites to remove them on request), and some agencies no longer release booking photos proactively. Check the rules in the specific state.' },
  { h: 'A mugshot is not a conviction', b: 'Charges listed with a booking are allegations. Many people photographed at booking are released, never charged, or later cleared. Treat a mugshot as a record of an arrest at a moment in time, not a verdict.' },
  { h: 'How to find a mugshot', b: 'Where a mugshot is published, it usually appears on the county sheriff’s jail roster (for recent bookings) or a state Department of Corrections offender page. Search “[County] sheriff jail roster,” or use the guides below to search by jurisdiction or name.' },
  { h: 'How removal works', b: 'Because publication is increasingly regulated, many jurisdictions and reputable sites offer removal. If a record about you appears in our directory, you can opt out — we honor removal requests for your own listing.' },
];

const WHAT = [
  ['Booking photo', 'The intake photo taken at the jail.'],
  ['Charges', 'The booking charges — allegations, not convictions.'],
  ['Booking date', 'When the arrest/booking occurred.'],
  ['Arresting agency', 'The department that made the arrest, where listed.'],
  ['Facility', 'The jail where the person was booked.'],
];

const FAQS = [
  { q: 'Are mugshots public record?', a: 'Usually, yes — booking/arrest records including mugshots are public record in most states. However, publication is increasingly restricted: several states limit the commercial use of mugshots and require removal on request, and some agencies no longer release them proactively. Laws vary by state.' },
  { q: 'Does a mugshot mean someone was convicted?', a: 'No. A mugshot only means a person was arrested and booked. The listed charges are allegations; the person may be released, never charged, or later found not guilty.' },
  { q: 'How do I find someone’s mugshot?', a: 'Check the county sheriff’s jail roster for recent bookings, or a state DOC offender page for someone in prison. Search “[County] sheriff jail roster,” or use a name-based public-records search when you don’t know the jurisdiction.' },
  { q: 'Can I get my mugshot removed?', a: 'Often, yes. Many jurisdictions and reputable sites offer removal, and some state laws require it. If your record appears in our directory, you can opt out — we honor removal requests for your own listing.' },
  { q: 'Is it legal to publish mugshots?', a: 'It depends on the state. Publishing public records is generally permitted, but a growing number of states restrict the commercial publication of mugshots — especially charging fees for removal — so the rules differ by jurisdiction.' },
];

export default function MugshotsGuide() {
  const crumbs = [{ name: 'Guides', path: '/guides' }, { name: 'Are Mugshots Public Record?', path: PATH }];
  const jsonLd = [
    crumbsJsonLd(crumbs),
    faqJsonLd(FAQS),
    { '@context': 'https://schema.org', '@type': 'Article', headline: 'Are Mugshots Public Record?', mainEntityOfPage: `${SITE}${PATH}`, about: 'Mugshot public records and publication law' },
  ];
  return (
    <main style={ui.main}>
      <JsonLd blocks={jsonLd} />
      <Breadcrumbs crumbs={crumbs} />
      <header style={ui.hero}>
        <p style={ui.eyebrow}>Public Records Guide</p>
        <h1 style={ui.h1}>Are Mugshots Public Record?</h1>
        <p style={ui.lead}>Short answer: in most states, yes — but publication is increasingly restricted, and a mugshot is never proof of guilt. Here’s what a mugshot is, how to find one, and how removal works.</p>
      </header>
      <section style={ui.card}>
        <h2 style={ui.h2}>The essentials</h2>
        {POINTS.map((s) => (
          <div key={s.h} style={{ marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, color: ui.color.ink }}>{s.h}</h3>
            <p style={{ margin: 0, color: ui.color.body }}>{s.b}</p>
          </div>
        ))}
      </section>
      <section style={ui.card}>
        <h2 style={ui.h2}>What a mugshot record includes</h2>
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
