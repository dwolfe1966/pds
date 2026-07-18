import React, { useEffect, useState } from 'react';
import { fetchBookings } from '../services/incarcerationService';

/**
 * Inmate booking teaser. Fetches real incarceration records from our first-party /api/incarceration and
 * shows a locked preview. SAFE-BY-DEFAULT: renders NOTHING until records exist.
 *
 * TWO MODES:
 *  - LOOSE (default) — for NAME-SEARCH surfaces (/name/landing/v3): shows all records matching name+state,
 *    framed as "records matching this name". Honest there — the user is browsing a name, not a person.
 *  - STRICT (`strict` + `personAge`) — for a SPECIFIC PROFILE/SUP: a name+state match can be a DIFFERENT
 *    same-name person, so we must NOT stamp a stranger's mugshot/charges onto this profile. We only surface
 *    records that CORROBORATE the person on age (±2). States that expose no age can't corroborate → nothing.
 *    Even a corroborated hit isn't a confirmed ID, so the copy says "Possible match — verify".
 */
export default function InmateBookingTeaser({ firstName, lastName, state, city, personAge, strict = false, accent = '#007cc2', dark = '#055a86' }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!lastName) return undefined;
    fetchBookings({ firstName, lastName, state, city })
      .then((r) => { if (alive) setData(r); })
      .catch(() => { /* stays hidden */ });
    return () => { alive = false; };
  }, [firstName, lastName, state, city]);

  const all = (data && data.records) || [];
  // STRICT: corroborate on age (±2) so we never attribute a same-name stranger's record to this profile.
  const pa = parseInt(personAge, 10);
  const matched = strict
    ? all.filter((r) => Number.isFinite(pa) && Number.isFinite(r.age) && Math.abs(r.age - pa) <= 2)
    : all;
  const count = strict ? matched.length : ((data && data.count) || 0);
  if (!data || count === 0) return null; // nothing corroborated / nothing to show

  const records = matched.slice(0, 4);
  const exampleCharges = [...new Set(matched.flatMap((r) => r.charges || []).filter(Boolean))];
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  return (
    <div style={{ marginTop: '1rem', border: `1px solid ${accent}33`, borderRadius: 12, background: '#f7fbfe', padding: '0.9rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>🔒</span>
        <span style={{ fontWeight: 800, color: dark, fontSize: '0.95rem' }}>
          {strict
            ? <>Possible incarceration record for {fullName} — verify this is the right person</>
            : <>{count} booking record{count === 1 ? '' : 's'} found for {fullName}{state ? ` in ${state}` : ''}</>}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
        {records.map((r, i) => (
          <div key={i} style={{ flex: '0 0 auto', width: 68, textAlign: 'center' }}>
            <div style={{ width: 68, height: 68, borderRadius: 8, background: '#dbe9f2', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              <span>👤</span>
              {r.mugshotUrl && <img src={r.mugshotUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3, userSelect: 'none' }}>
              {r.charges && r.charges.length ? `${r.charges.length} charge${r.charges.length === 1 ? '' : 's'}` : 'Record'}
            </div>
          </div>
        ))}
      </div>
      {exampleCharges.length > 0 && (
        <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#374151', lineHeight: 1.4 }}>
          <span aria-hidden="true" style={{ color: '#b91c1c' }}>⚖️ </span>
          {exampleCharges.slice(0, 2).join(' · ')}
          {exampleCharges.length > 2 ? ` +${exampleCharges.length - 2} more` : ''}
        </p>
      )}
      <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#5b7484', lineHeight: 1.45 }}>
        Continue to unlock mugshots, charges, booking dates, and facility details.
      </p>
    </div>
  );
}
