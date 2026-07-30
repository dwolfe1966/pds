'use client';

// Client typeahead for the HomeFacts landing. Filters the pre-built city index (passed from the server
// component — no API round-trip) and links each match to its area-profile page. City-name search is v1; a
// ZIP/address resolver is the next step (honest hint shown when the query looks like a ZIP).

import { useMemo, useState } from 'react';

const C = { ink: '#172033', body: '#344054', muted: '#667085', border: '#d8e0ea', soft: '#f6f8fb', accent: '#12507e' };

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

  // ZIP (5 digits) or street-address (has a digit and a space) → resolve via the keyless API to a profile URL.
  const isZip = /^\d{5}$/.test(query);
  const isAddress = !isZip && /\d/.test(query) && /\s/.test(query);
  const resolvable = isZip || isAddress;

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function resolve() {
    setBusy(true); setErr('');
    try {
      const r = await fetch(`/api/homefacts/resolve?q=${encodeURIComponent(q.trim())}`);
      const d = await r.json();
      if (d.url) { window.location.href = d.url; return; }
      setErr(d.error || 'Could not locate that.');
    } catch { setErr('Search failed — try again.'); }
    setBusy(false);
  }

  return (
    <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto' }}>
      <form onSubmit={(e) => { e.preventDefault(); if (resolvable) resolve(); }}
        style={{ display: 'flex', background: '#fff', borderRadius: 10, padding: 6, boxShadow: '0 6px 24px rgba(16,24,40,.12)', border: `1px solid ${C.border}` }}>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setErr(''); }}
          placeholder="Enter a city, ZIP code, or address"
          aria-label="Search a city, ZIP code, or address"
          style={{ flex: 1, border: 0, outline: 'none', fontSize: 16, padding: '11px 12px', color: C.ink, background: 'transparent' }}
        />
        <button type="submit" disabled={busy}
          style={{ border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', background: C.accent, color: '#fff', fontWeight: 800, fontSize: 15, padding: '0 20px', borderRadius: 8 }}>
          {busy ? 'Locating…' : 'Search'}
        </button>
      </form>

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

      {resolvable && (
        <button type="button" onClick={resolve} disabled={busy}
          style={{ marginTop: 8, width: '100%', textAlign: 'left', cursor: 'pointer', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 15px', color: C.ink, fontSize: 15 }}>
          {busy ? 'Locating…' : <>Look up {isZip ? `ZIP ${q.trim()}` : 'this address'} →</>}
        </button>
      )}

      {err && <p style={{ marginTop: 8, fontSize: 13.5, color: '#b23a48' }}>{err}</p>}
      {!resolvable && query.length >= 2 && matches.length === 0 && (
        <p style={{ marginTop: 10, fontSize: 13.5, color: C.muted }}>No city matching “{q}”. Try a different spelling, a nearby larger city, or a ZIP code.</p>
      )}
    </div>
  );
}
