'use client';

// Address-centered map, high on the page — shows ONLY on an address search (?alat=&alng= in the URL), so a
// visitor who searched an address immediately sees it on a map with a marker. Client-only (address is URL-only),
// renders nothing on a normal city/ZIP visit. OpenStreetMap embed — zero deps, no key.
import { useEffect, useState } from 'react';

function embedSrc(lat, lng) {
  const dLat = 0.018, dLng = dLat * 1.4; // ~tight neighborhood view
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((n) => n.toFixed(5)).join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lng.toFixed(5)}`;
}

export default function AddressMap({ height = 300 }) {
  const [pt, setPt] = useState(null);
  const [label, setLabel] = useState('');
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const lat = parseFloat(p.get('alat')), lng = parseFloat(p.get('alng'));
      if (Number.isFinite(lat) && Number.isFinite(lng)) { setPt({ lat, lng }); setLabel(p.get('from') || ''); }
    } catch { /* none */ }
  }, []);
  if (!pt) return null;

  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #dce4ec', marginBottom: 16, boxShadow: '0 1px 2px rgba(15,34,51,.04), 0 8px 26px rgba(15,34,51,.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#e8f1f8', borderBottom: '1px solid #cbe0ef', fontSize: 13, fontWeight: 800, color: '#0c3a5c' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#12507e" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21c4.5-4.5 7-8 7-11a7 7 0 1 0-14 0c0 3 2.5 6.5 7 11Z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        <span>Your address{label ? <span style={{ fontWeight: 600, color: '#3a4a5c', marginLeft: 6 }}>· {label}</span> : null}</span>
      </div>
      <iframe title="Map of your address" src={embedSrc(pt.lat, pt.lng)} loading="lazy" style={{ width: '100%', height, border: 0, display: 'block' }} />
    </div>
  );
}
