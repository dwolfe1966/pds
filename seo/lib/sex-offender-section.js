// Shared registered-sex-offender renderer — used by the name-in-state, city, and (optionally) county SEO
// surfaces. Owner confirmed display rights 2026-07-20. Data is NSOPW (national aggregator) + state
// registries via lib/sexOffenderDb.mjs; each record links to its authoritative jurisdiction registry
// record (registryUrl) and carries an "as of" freshness date. Renders null when there are no records.
import { ui } from './ui';

// Registry placeholders that aren't real locations (incarcerated / homeless / unknown) — don't render them
// as a city/zip.
const JUNK = new Set(['', 'unknown', 'none', 'n/a', 'na', 'incarcerated', 'homeless', 'transient', 'unavailable',
  'out of state', 'out-of-state', 'refused', 'not reported', 'not available', 'unk']);
const realVal = (s) => { const t = String(s || '').trim(); return t && !JUNK.has(t.toLowerCase()) ? t : ''; };
const realZip = (z) => { const t = String(z || '').trim(); return /^\d{5}/.test(t) && t !== '00000' ? t.slice(0, 5) : ''; };
const cap = (s) => String(s || '').toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());

function OffenderCard({ rec }) {
  const cityCap = realVal(rec.city) ? cap(rec.city) : '';
  const ctyCap = realVal(rec.county) ? `${cap(rec.county)} County` : '';
  const loc = [cityCap, ctyCap, realZip(rec.zip)].filter(Boolean).join(' · ');
  const photo = rec.photoUrl
    ? { backgroundColor: '#e5e7eb', backgroundImage: `url(${rec.photoUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: '#eef1f4' };
  const aka = (rec.aliases || []).filter(Boolean).slice(0, 2).join(', ');
  return (
    <div style={{ display: 'flex', gap: 12, border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
      <div aria-hidden="true" style={{ flexShrink: 0, width: 56, height: 68, borderRadius: 8, ...photo }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#111827' }}>
          {cap(rec.name)}{rec.age ? `, ${rec.age}` : ''}
          {rec.absconder && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#b91c1c', background: '#fee2e2', padding: '1px 6px', borderRadius: 4 }}>ABSCONDER</span>}
        </div>
        {loc && <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>📍 {loc}</div>}
        {aka && <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 2 }}>AKA {cap(aka)}</div>}
        {rec.registryUrl && (
          <div style={{ marginTop: 4 }}>
            <a href={rec.registryUrl} target="_blank" rel="noopener nofollow" style={{ fontSize: 12.5, color: '#0d5d2f', fontWeight: 600 }}>
              Official registry record →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/** Full section: heading + blurb + list + source/compliance note. Renders null when there are no records. */
export function SexOffenderSection({ records, heading, blurb }) {
  if (!records || records.length === 0) return null;
  return (
    <section style={{ ...ui.card, marginTop: 20 }}>
      <h2 style={{ marginTop: 0, fontSize: 18 }}>{heading}</h2>
      {blurb && <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>{blurb}</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {records.map((rec, i) => <OffenderCard key={rec.offenderId || i} rec={rec} />)}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
        Source: Dru Sjodin National Sex Offender Public Website (NSOPW) and state registries. Public record.
        This information is provided for public awareness. Using it to harass, threaten, or discriminate
        against any registrant, or for any purpose prohibited by law, is illegal. Verify against the official
        registry record before relying on it.
      </p>
    </section>
  );
}
