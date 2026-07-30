'use client';

// When the visitor arrived via an ADDRESS search (?alat=&alng= in the URL), show a compact, distance-sorted
// "nearest to your address" list for a set of points (offenders / schools). Client-only: the address origin is
// only knowable from the URL (ISR pages can't read query params server-side). Renders nothing when there's no
// address or no points with coordinates — so normal city/ZIP/county visits are unaffected.
import { useEffect, useState } from 'react';

function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.8, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

const C = { ink: '#0f2233', body: '#38465a', muted: '#667085', accent: '#12507e', soft: '#e8f1f8', line: '#cbe0ef' };

export default function NearestToAddress({ items, title = 'Nearest to your address', accent = C.accent, limit = 8 }) {
  const [origin, setOrigin] = useState(null);
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const lat = parseFloat(p.get('alat')), lng = parseFloat(p.get('alng'));
      if (Number.isFinite(lat) && Number.isFinite(lng)) setOrigin({ lat, lng });
    } catch { /* no origin */ }
  }, []);

  if (!origin) return null;
  const ranked = (items || [])
    .filter((it) => Number.isFinite(it.lat) && Number.isFinite(it.lng))
    .map((it) => ({ ...it, mi: milesBetween(origin.lat, origin.lng, it.lat, it.lng) }))
    .sort((a, b) => a.mi - b.mi)
    .slice(0, limit);
  if (ranked.length === 0) return null;

  return (
    <div style={{ margin: '0 0 16px', border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', background: C.soft, borderBottom: `1px solid ${C.line}`, fontSize: 12.5, fontWeight: 800, color: '#0c3a5c' }}>
        <span aria-hidden="true">📍</span> {title}
      </div>
      <div>
        {ranked.map((it, i) => {
          const row = (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 13px', borderTop: i ? `1px solid #eef2f6` : 0 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.ink, fontWeight: 600 }}>
                {it.label}{it.sub ? <span style={{ color: C.muted, fontWeight: 400 }}> · {it.sub}</span> : null}
              </span>
              <span style={{ flex: 'none', fontSize: 13, fontWeight: 800, color: accent, fontVariantNumeric: 'tabular-nums' }}>{it.mi.toFixed(1)} mi</span>
            </div>
          );
          return it.href
            ? <a key={i} href={it.href} style={{ display: 'block', textDecoration: 'none' }}>{row}</a>
            : <div key={i}>{row}</div>;
        })}
      </div>
    </div>
  );
}
