import React, { useEffect, useState } from 'react';
import { fetchBookings } from '../services/incarcerationService';

/**
 * Inmate booking teaser for the /name/landing/v3 flow. Fetches real incarceration records (mugshots,
 * charges, facility, booking date) from our first-party /api/incarceration and shows a locked preview
 * that motivates the searcher to continue. SAFE-BY-DEFAULT: renders NOTHING until a data source is live
 * (count 0) or while loading, so it can sit in the live funnel now and light up when the feed is wired.
 */
export default function InmateBookingTeaser({ firstName, lastName, state, city, accent = '#007cc2', dark = '#055a86' }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!lastName) return undefined;
    fetchBookings({ firstName, lastName, state, city })
      .then((r) => { if (alive) setData(r); })
      .catch(() => { /* stays hidden */ });
    return () => { alive = false; };
  }, [firstName, lastName, state, city]);

  const count = (data && data.count) || 0;
  if (count === 0) return null; // nothing to show yet — no funnel disruption

  const records = (data.records || []).slice(0, 4);
  return (
    <div style={{ marginTop: '1rem', border: `1px solid ${accent}33`, borderRadius: 12, background: '#f7fbfe', padding: '0.9rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>🔒</span>
        <span style={{ fontWeight: 800, color: dark, fontSize: '0.95rem' }}>
          {count} booking record{count === 1 ? '' : 's'} found for {[firstName, lastName].filter(Boolean).join(' ')}{state ? ` in ${state}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
        {records.map((r, i) => (
          <div key={i} style={{ flex: '0 0 auto', width: 68, textAlign: 'center' }}>
            <div style={{ width: 68, height: 68, borderRadius: 8, background: '#dbe9f2', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              <span style={{ filter: 'blur(2px)' }}>👤</span>
              {r.mugshotUrl && <img src={r.mugshotUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(5px)' }} />}
            </div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3, filter: 'blur(2px)', userSelect: 'none' }}>
              {r.charges && r.charges.length ? `${r.charges.length} charge${r.charges.length === 1 ? '' : 's'}` : 'Record'}
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#5b7484', lineHeight: 1.45 }}>
        Continue to unlock mugshots, charges, booking dates, and facility details.
      </p>
    </div>
  );
}
