// Shared incarceration record renderer — used by BOTH the name-in-state and (county-grain) name-in-city
// SEO pages so the record card stays consistent and DRY. Surfaces EVERY roster field we store (all public
// record): mugshot, name/age, facility + county + state, custody/release status, booking date, sex, race,
// and the full charge list. "Maximize the data we have" (owner 2026-07-20) on the differentiated pages.
import { ui } from './ui';

// OBIS appends the county of conviction to each charge, e.g. "FELONY BATTERY (SARASOTA)". Pull the first
// county out to show as the record's location, and strip it off the charge text so charges read cleanly.
export function splitCounty(charges) {
  let county = null;
  const cleaned = (charges || []).map((c) => {
    const s = String(c);
    const m = s.match(/\s*\(([A-Z][A-Z .'-]+)\)\s*$/);
    if (m) { if (!county) county = m[1].trim(); return s.slice(0, m.index).trim(); }
    return s;
  });
  return { county, cleaned };
}

const cap = (s) => { const t = String(s || '').trim(); return t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : ''; };
const statusLabel = (s) => cap(String(s || '').replace(/_/g, ' ')); // "in_custody" → "In custody"
const fmtDate = (d) => { const s = String(d || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; };
const sexLabel = (g) => {
  const s = String(g || '').trim().toUpperCase();
  return s === 'M' || s === 'MALE' ? 'Male' : s === 'F' || s === 'FEMALE' ? 'Female' : cap(g);
};

export function InmateRecordCard({ rec }) {
  const { county, cleaned } = splitCounty(rec.charges);
  const cty = rec.county || county;
  const loc = [rec.facility, [cty ? `${cty} County` : null, rec.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  const meta = [
    rec.releaseStatus ? statusLabel(rec.releaseStatus) : null,
    fmtDate(rec.bookingDate) ? `Booked ${fmtDate(rec.bookingDate)}` : null,
    rec.gender ? sexLabel(rec.gender) : null,
    rec.race ? cap(rec.race) : null,
  ].filter(Boolean);
  // Mugshot via background-image: if the public DOC photo 404s (released/no-photo) it degrades to a clean
  // gray box — no broken-image icon (server-rendered, no client onError available).
  const photo = rec.mugshotUrl
    ? { backgroundColor: '#e5e7eb', backgroundImage: `url(${rec.mugshotUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: '#eef1f4' };
  return (
    <div style={{ display: 'flex', gap: 12, border: `1px solid ${ui.color.softBorder}`, borderRadius: 8, padding: '12px 14px', background: '#fff' }}>
      <div aria-hidden="true" style={{ flexShrink: 0, width: 56, height: 68, borderRadius: 8, ...photo }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, color: ui.color.ink }}>{rec.name}{rec.age ? `, ${rec.age}` : ''}</div>
        {loc && <div style={{ fontSize: 13, color: ui.color.body, marginTop: 2 }}>{loc}</div>}
        {meta.length > 0 && <div style={{ fontSize: 12.5, color: ui.color.muted, marginTop: 2 }}>{meta.join(' · ')}</div>}
        {cleaned.length > 0 && (
          <div style={{ fontSize: 12.5, color: ui.color.muted, marginTop: 3 }}>
            {cleaned.slice(0, 4).join(' · ')}{cleaned.length > 4 ? ` +${cleaned.length - 4} more` : ''}
          </div>
        )}
      </div>
    </div>
  );
}

/** The full section (heading + blurb + list + source note). Renders null when there are no records. */
export function InmateRecordsSection({ records, heading, blurb }) {
  if (!records || records.length === 0) return null;
  return (
    <section style={{ ...ui.card, marginTop: 20 }}>
      <h2 style={ui.h2}>{heading}</h2>
      {blurb && <p style={{ margin: '0 0 12px', fontSize: 13, color: ui.color.muted, lineHeight: 1.6 }}>{blurb}</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {records.map((rec, i) => <InmateRecordCard key={i} rec={rec} />)}
      </div>
      <p style={ui.source}>
        Source: state DOC &amp; county correctional rosters. Public record, not a consumer report.
      </p>
    </section>
  );
}
