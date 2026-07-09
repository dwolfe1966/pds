// Name-in-state — /people/{state}/{first-last}, e.g. /people/tx/john-smith.
// The leaf of the state-first surface: name statistics scoped to the state + a
// SERP hand-off that now carries the state (so the idlookup.ai search works).
import { notFound } from 'next/navigation';
import { getNameInState, getStateTopNames } from '../../../../lib/directory';
import { stateNamePath, statePath } from '../../../../lib/ids';
import { crumbsJsonLd } from '../../../../lib/schema';
import { ui, Breadcrumbs, FcraFooter, JsonLd } from '../../../../lib/ui';
import { SITE, MAIN } from '../../../../lib/site';

export const revalidate = 5184000; // 60d

const num = (n) => (n == null ? '' : Number(n).toLocaleString('en-US'));
const serpHref = (first, last, state) =>
  `${MAIN}/name/search-result?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}&state=${encodeURIComponent(state)}&utm_source=seo&utm_medium=organic`;

export async function generateMetadata({ params }) {
  const { state, name } = await params;
  const d = getNameInState(state, name);
  if (!d) return { title: 'Not found' };
  const full = `${d.first} ${d.last}`;
  return {
    title: `${full} in ${d.stateName} — Find & Search | IDLookup`,
    description: `Looking for ${full} in ${d.stateName}? An estimated ${num(d.estInState)} people named ${full} live in ${d.stateName}. Search by city, age, and relatives to find the right person.`,
    alternates: { canonical: `${SITE}${stateNamePath(state, name)}` },
  };
}

const stat = {
  wrap: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 },
  card: { flex: '1 1 200px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px' },
  label: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', fontWeight: 700 },
  big: { fontSize: 24, fontWeight: 800, color: '#0d5d2f', margin: '2px 0 4px' },
  sub: { fontSize: 13, color: '#374151' },
};

export default async function NameInState({ params }) {
  const { state, name } = await params;
  const d = getNameInState(state, name);
  if (!d) notFound();

  const full = `${d.first} ${d.last}`;
  const crumbs = [
    { name: 'People Search', path: '/people' },
    { name: d.stateName, path: statePath(state) },
    { name: full, path: stateNamePath(state, name) },
  ];
  const ordinal = (r) => (r ? `#${num(r)}` : '');
  const related = getStateTopNames(state, 60).filter((r) => r.slug !== name).slice(0, 8);

  return (
    <main style={ui.main}>
      <JsonLd blocks={[crumbsJsonLd(crumbs)]} />
      <Breadcrumbs crumbs={crumbs} />

      <h1 style={ui.h1}>{full} in {d.stateName}</h1>
      <p style={{ margin: '0 0 20px', fontSize: 17, lineHeight: 1.6 }}>
        An estimated <strong>{num(d.estInState)}</strong> people named {full} live in {d.stateName}.
        Below is how common the name is nationally — then search to find the specific {full} you're looking for in {d.stateName}.
      </p>

      <a href={serpHref(d.first, d.last, d.state)} style={{ ...ui.cta, fontSize: 16 }}>Search {full} in {d.stateName} →</a>

      <div style={{ ...stat.wrap, marginTop: 20 }}>
        <div style={stat.card}>
          <div style={stat.label}>First name</div>
          <div style={stat.big}>{d.first}</div>
          <div style={stat.sub}>
            {d.firstRank ? <>{ordinal(d.firstRank)} most common first name in the U.S.</> : 'A U.S. given name'}
            {d.firstCount ? <> · ~{num(d.firstCount)} nationwide</> : null}
          </div>
        </div>
        <div style={stat.card}>
          <div style={stat.label}>Surname</div>
          <div style={stat.big}>{d.last}</div>
          <div style={stat.sub}>
            {d.lastRank ? <>{ordinal(d.lastRank)} most common surname in the U.S.</> : 'A U.S. surname'}
            {d.lastCount ? <> · ~{num(d.lastCount)} nationwide</> : null}
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section style={ui.card}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>Other names in {d.stateName}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            {related.map((r) => (
              <a key={r.slug} href={stateNamePath(state, r.slug)} style={ui.link}>{r.name}</a>
            ))}
          </div>
        </section>
      )}

      <FcraFooter />
    </main>
  );
}
