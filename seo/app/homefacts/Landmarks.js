'use client';

// Nearby landmarks / notable places for an area profile. Client-only + additive. Uses the searched address
// (?alat=&alng=) when present, else the area's center. Source: Wikipedia GeoSearch (keyless; origin=* for
// CORS). Each result links to its Wikipedia article. Renders nothing until loaded or on failure.
import { useEffect, useState } from 'react';

const C = { ink: '#0f2233', body: '#38465a', muted: '#667085', accent: '#12507e', line: '#dce4ec' };

export default function Landmarks({ center, radius = 3000 }) {
  const [places, setPlaces] = useState(null);
  const [atAddress, setAtAddress] = useState(false);

  useEffect(() => {
    let alive = true;
    let lat = center && center.lat, lng = center && center.lng, addr = false;
    try {
      const p = new URLSearchParams(window.location.search);
      const a = parseFloat(p.get('alat')), b = parseFloat(p.get('alng'));
      if (Number.isFinite(a) && Number.isFinite(b)) { lat = a; lng = b; addr = true; }
    } catch { /* keep center */ }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
    setAtAddress(addr);

    fetch(`https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}%7C${lng}&gsradius=${radius}&gslimit=10&format=json&origin=*`, { signal: AbortSignal.timeout(9000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const g = (d.query && d.query.geosearch) || [];
        setPlaces(g.map((x) => ({ title: x.title, mi: (x.dist || 0) / 1609.34, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(x.title.replace(/ /g, '_'))}` })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [center, radius]);

  if (!places || places.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.body, marginBottom: 8 }}>
        Landmarks {atAddress ? 'near your address' : 'nearby'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px 18px' }}>
        {places.map((p, i) => (
          <a key={i} href={p.url} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'baseline', gap: 8, textDecoration: 'none', fontSize: 14 }}>
            <span style={{ flex: 1, minWidth: 0, color: C.accent, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
            <span style={{ flex: 'none', fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{p.mi.toFixed(1)} mi</span>
          </a>
        ))}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11.5, color: C.muted }}>Source: Wikipedia. Links open Wikipedia articles.</p>
    </div>
  );
}
