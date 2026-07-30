'use client';

// AreaMap — the location map for HomeFacts area profiles. OpenStreetMap embed (iframe), zero deps, no key.
// Renders city/ZIP-centered by default (SSR-stable). When the visitor arrived via an ADDRESS search
// (?alat=&alng= in the URL, set by the resolver), a client effect re-centers the map on the address and drops
// a marker there — so "position the address on a map" works while staying hydration-safe (SSR = area center;
// the effect only tightens onto the address after mount).
import { useEffect, useState } from 'react';

function embedSrc(lat, lng, zoom) {
  const dLat = zoom >= 14 ? 0.02 : zoom >= 13 ? 0.04 : zoom >= 11 ? 0.09 : 0.18;
  const dLng = dLat * 1.4;
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((n) => n.toFixed(5)).join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lng.toFixed(5)}`;
}

export function AreaMap({ lat, lng, label, zoom = 12, height = 300 }) {
  if (lat == null || lng == null) return null;
  const [src, setSrc] = useState(() => embedSrc(lat, lng, zoom));
  const [atAddress, setAtAddress] = useState(false);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const alat = parseFloat(p.get('alat')), alng = parseFloat(p.get('alng'));
      if (Number.isFinite(alat) && Number.isFinite(alng)) {
        setSrc(embedSrc(alat, alng, 15)); // tighten onto the searched address + marker
        setAtAddress(true);
      }
    } catch { /* keep area-centered default */ }
  }, []);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #dce4ec' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: '#e8f1f8', borderBottom: '1px solid #cbe0ef', fontSize: 12.5, fontWeight: 700, color: '#0c3a5c' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#12507e" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21c4.5-4.5 7-8 7-11a7 7 0 1 0-14 0c0 3 2.5 6.5 7 11Z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        {atAddress ? 'Your address' : (label || 'Map')}
      </div>
      <iframe
        title={atAddress ? 'Map of your address' : `Map of ${label || 'area'}`}
        src={src}
        loading="lazy"
        style={{ width: '100%', height, border: 0, display: 'block' }}
      />
    </div>
  );
}
