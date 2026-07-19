import React, { useEffect, useState } from 'react';
import { fetchBookings } from '../services/incarcerationService';

/**
 * Full booking / incarceration records for a person — the DELIVERED product on the report/detail page
 * (unblurred: real mugshots, full charge lists, facility, custody status). Self-gating: renders nothing
 * unless the person has booking records, so it only appears for the inmate vertical. First-party
 * /api/incarceration (JailBase / UCC / Florida OBIS / state DOC rosters), independent of BC.
 *
 * CORROBORATION (owner 2026-07-18): this is a SPECIFIC person's report, but the lookup matches only
 * name+state — a same-name stranger could otherwise get their mugshot/charges stamped on this person.
 * So we require age corroboration (±2) against the profile's age; records that don't corroborate (or when
 * the profile has no age to check) are NOT shown. Mirrors the strict mode of InmateBookingTeaser (SUP).
 */
export default function InmateBookingSection({ firstName, lastName, state, personAge }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!lastName) return undefined;
    fetchBookings({ firstName, lastName, state, age: personAge }).then((r) => { if (alive) setData(r); }).catch(() => {});
    return () => { alive = false; };
  }, [firstName, lastName, state, personAge]);

  // STRICT: only records whose age corroborates this profile (±2). No profile age → can't verify → show nothing.
  const pa = parseInt(personAge, 10);
  const records = Number.isFinite(pa)
    ? ((data && data.records) || []).filter((r) => Number.isFinite(r.age) && Math.abs(r.age - pa) <= 2)
    : [];
  if (!records.length) return null;

  return (
    <section style={{ margin: '20px 0', border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef2f7', background: '#f8faf9' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>🔒 Possible Booking &amp; Incarceration Records <span style={{ color: '#0d5d2f' }}>({records.length})</span></h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>Matched to this profile on name, state, and age (±2). Verify identity before relying on any record.</p>
      </div>
      <div style={{ display: 'grid', gap: 0 }}>
        {records.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 18px', borderBottom: i < records.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            <div style={{ flexShrink: 0, width: 84, height: 100, borderRadius: 8, overflow: 'hidden', background: '#e5e7eb', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#94a3b8' }}>
              👤
              {r.mugshotUrl && <img src={r.mugshotUrl} alt={`${r.name} booking photo`} onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{r.name}{r.age ? `, ${r.age}` : ''}</span>
                {r.releaseStatus && <span style={{ fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', ...(r.recordType === 'court' ? { color: '#b45309', background: '#fef3c7' } : { color: '#166534', background: '#dcfce7' }) }}>{r.releaseStatus}</span>}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{r.sourceName || r.source}</span>
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 3 }}>
                {[r.facility, [r.county, r.state].filter(Boolean).join(', '), r.bookingDate && `Booked ${r.bookingDate}`].filter(Boolean).join(' · ')}
              </div>
              {r.charges && r.charges.length > 0 && (
                <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
                  {r.charges.map((c, j) => (
                    <li key={j} style={{ fontSize: 13, color: '#334155', display: 'flex', gap: 6 }}><span style={{ color: '#b91c1c' }}>⚖️</span><span>{c}</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 18px', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #eef2f7' }}>
        Public records. Not a consumer report — do not use for FCRA-covered decisions (employment, tenant, credit).
      </div>
    </section>
  );
}
