// HomeFacts methodology / about — what we cover, where the data comes from, and how we handle coverage &
// accuracy. Trust surface + a bit of SEO. Static.
import { hf, hfColor, HfHeader, HfBreadcrumbs, Section } from '../../../lib/hf';
import { FcraFooter } from '../../../lib/ui';
import { SITE } from '../../../lib/site';

export const revalidate = 5184000;

export function generateMetadata() {
  return {
    title: 'How HomeFacts Works — Data Sources & Methodology | Homefacts',
    description: 'Where HomeFacts neighborhood data comes from — U.S. Census, FBI, FEMA, EPA, NCES, USGS and more — and how we handle coverage, freshness, and accuracy.',
    alternates: { canonical: `${SITE}/homefacts/about` },
  };
}

const SOURCES = [
  ['Demographics · Property', 'U.S. Census Bureau — American Community Survey (5-year), at city, county, and ZIP-code (ZCTA) level.'],
  ['Schools', 'U.S. Dept. of Education — NCES Common Core of Data (public schools, enrollment, grade spans).'],
  ['Crime', 'FBI Uniform Crime Reporting / NIBRS (agency rates vs. state and national); plus incident-level open data from major-city portals for address searches.'],
  ['Natural disasters', 'FEMA National Risk Index (county hazard ratings) and the National Flood Hazard Layer (flood zone at a point).'],
  ['Environmental hazards', 'U.S. EPA — Toxics Release Inventory (facilities reporting chemical releases).'],
  ['Seismic activity', 'U.S. Geological Survey (recent earthquakes).'],
  ['Weather · Air quality', 'Open-Meteo (current conditions, US AQI) and the U.S. National Weather Service (active alerts).'],
  ['Sex-offender registry', 'Public state sex-offender registries (first-party, continuously refreshed).'],
  ['Incarceration records', 'State and county correctional rosters (first-party).'],
  ['Neighborhood & landmarks', 'Wikipedia / Wikidata, the National Park Service, the Library of Congress, and OpenStreetMap (nearby places & amenities).'],
];

export default function AboutPage() {
  const crumbs = [{ name: 'Homefacts', path: '/homefacts' }, { name: 'How it works', path: '/homefacts/about' }];
  return (
    <div style={hf.page}>
      <HfHeader />
      <main style={hf.main}>
        <HfBreadcrumbs crumbs={crumbs} />

        <section style={{ ...hf.card, marginBottom: 8, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${hfColor.accentSoft} 0%, ${hfColor.surface} 62%)` }}>
          <p style={hf.eyebrow}>How it works</p>
          <h1 style={hf.h1}>Real data, sourced — never estimated.</h1>
          <p style={hf.lead}>
            HomeFacts builds a neighborhood report for any U.S. city, county, ZIP code, or address from public and
            first-party data. Every figure is drawn from a named source below — we don&apos;t fabricate or model
            numbers to fill a page.
          </p>
        </section>

        <Section id="sources" icon="summary" eyebrow="Sources" title="Where the data comes from">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {SOURCES.map(([k, v]) => (
              <div key={k}>
                <div style={{ fontSize: 14.5, fontWeight: 750, color: hfColor.ink }}>{k}</div>
                <div style={{ fontSize: 14, color: hfColor.body, lineHeight: 1.6, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="coverage" icon="neighborhood" eyebrow="Honesty" title="Coverage & freshness">
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li style={{ fontSize: 14, color: hfColor.body, lineHeight: 1.6, marginBottom: 8 }}><strong>We show a module only when we have real data for it.</strong> Where a public agency doesn&apos;t report (for example, a police department that doesn&apos;t submit crime data to the FBI), we say so rather than invent a number.</li>
            <li style={{ fontSize: 14, color: hfColor.body, lineHeight: 1.6, marginBottom: 8 }}><strong>Live conditions</strong> — weather, air quality, active alerts, recent crime and earthquakes — are fetched in real time and reflect the moment you view the page.</li>
            <li style={{ fontSize: 14, color: hfColor.body, lineHeight: 1.6, marginBottom: 8 }}><strong>Census-based figures</strong> (demographics, property, income) come from the most recent 5-year American Community Survey and are updated as new vintages publish.</li>
            <li style={{ fontSize: 14, color: hfColor.body, lineHeight: 1.6 }}><strong>Address searches</strong> orient every map and distance to the exact point — how far the nearest offender, school, or recent incident is from that address.</li>
          </ul>
        </Section>

        <FcraFooter />
      </main>
    </div>
  );
}
