'use client';

// Client typeahead for the HomeFacts landing. Filters the pre-built city index (passed from the server
// component — no API round-trip) and links each match to its area-profile page. City-name search is v1; a
// ZIP/address resolver is the next step (honest hint shown when the query looks like a ZIP).

import { useMemo, useState } from 'react';

const C = { ink: '#172033', body: '#344054', muted: '#667085', border: '#d8e0ea', soft: '#f6f8fb', accent: '#0d5d2f' };

export default function HomefactsSearch({ cities }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const matches = useMemo(() => {
    if (query.length < 2) return [];
    // Rank: prefix match on city name first, then substring; cap at 10.
    const scored = [];
    for (const c of cities) {
      const name = c.c.toLowerCase();
      const combo = `${name}, ${c.s}`;
      let score = -1;
      if (name.startsWith(query)) score = 0;
      else if (combo.startsWith(query)) score = 1;
      else if (name.includes(query)) score = 2;
      if (score >= 0) scored.push([score, c.pop || 0, c]);
    }
    scored.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    return scored.slice(0, 10).map((x) => x[2]);
  }, [query, cities]);

  const looksLikeZip = /^\d{3,5}$/.test(query);

  return (
    <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ display: 'flex', background: '#fff', borderRadius: 10, padding: 6, boxShadow: '0 6px 24px rgba(16,24,40,.12)', border: `1px solid ${C.border}` }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Enter a city or town — e.g. Austin, TX"
          aria-label="Search a city or town"
          style={{ flex: 1, border: 0, outline: 'none', fontSize: 16, padding: '11px 12px', color: C.ink, background: 'transparent' }}
        />
        <span style={{ display: 'inline-flex', alignItems: 'center', background: C.accent, color: '#fff', fontWeight: 800, fontSize: 15, padding: '0 20px', borderRadius: 8 }}>Search</span>
      </div>

      {matches.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, marginTop: 6, background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', boxShadow: '0 12px 32px rgba(16,24,40,.16)', textAlign: 'left' }}>
          {matches.map((c) => (
            <a key={`${c.s}/${c.slug}`} href={`/homefacts/${c.s}/${c.slug}`}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '11px 15px', textDecoration: 'none', color: C.ink, fontSize: 15, borderTop: `1px solid ${C.soft}` }}>
              <span><strong>{c.c}</strong>, {c.s.toUpperCase()}</span>
              <span style={{ color: C.muted, fontSize: 13 }}>{c.n}</span>
            </a>
          ))}
        </div>
      )}

      {query.length >= 2 && matches.length === 0 && (
        <p style={{ marginTop: 10, fontSize: 13.5, color: C.muted }}>
          {looksLikeZip
            ? 'ZIP-code and street-address lookup is coming next — for now, search by city or town name.'
            : `No city matching “${q}”. Try a different spelling or a nearby larger city.`}
        </p>
      )}
    </div>
  );
}
