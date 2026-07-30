'use client';

// At-a-glance safety summary for an ADDRESS search (?alat=&alng= in the URL): how many registered offenders
// are within 1 and 3 miles, the nearest offender distance, and the nearest school. Client-only (address is
// URL-only; ISR pages can't read it server-side). Renders nothing on normal (non-address) visits.
import { useEffect, useState } from 'react';

function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.8, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}
const dists = (origin, pts) => (pts || [])
  .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  .map((p) => milesBetween(origin.lat, origin.lng, p.lat, p.lng))
  .sort((a, b) => a - b);

export default function AddressSafetySummary({ offenders, schools }) {
  const [origin, setOrigin] = useState(null);
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const lat = parseFloat(p.get('alat')), lng = parseFloat(p.get('alng'));
      if (Number.isFinite(lat) && Number.isFinite(lng)) setOrigin({ lat, lng });
    } catch { /* no origin */ }
  }, []);
  if (!origin) return null;

  const offD = dists(origin, offenders);
  const schD = dists(origin, schools);
  if (offD.length === 0 && schD.length === 0) return null;

  const within1 = offD.filter((d) => d <= 1).length;
  const within3 = offD.filter((d) => d <= 3).length;
  const nearestOff = offD.length ? offD[0] : null;
  const nearestSch = schD.length ? schD[0] : null;

  const alert = within1 > 0;
  const bg = alert ? '#f8e6e8' : '#e8f1f8';
  const line = alert ? '#e5b8bf' : '#cbe0ef';
  const ink = alert ? '#8f2833' : '#0c3a5c';

  const cells = [];
  if (offD.length) {
    cells.push({ v: within1, l: 'offenders within 1 mile', tone: within1 > 0 ? '#b23a48' : '#2e7d52' });
    cells.push({ v: within3, l: 'within 3 miles', tone: within3 > 0 ? '#b26a12' : '#2e7d52' });
    if (nearestOff != null) cells.push({ v: `${nearestOff.toFixed(1)} mi`, l: 'nearest offender', tone: ink });
  }
  if (nearestSch != null) cells.push({ v: `${nearestSch.toFixed(1)} mi`, l: 'nearest school', tone: '#12507e' });

  return (
    <div style={{ margin: '0 0 16px', border: `1px solid ${line}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: bg, borderBottom: `1px solid ${line}`, fontSize: 12.5, fontWeight: 800, color: ink }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 3 5 6v5c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6l-7-3Z" />
        </svg>
        Safety near your address
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, 1fr)`, gap: 1, background: '#eef2f6' }}>
        {cells.map((c, i) => (
          <div key={i} style={{ background: '#fff', padding: '13px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 850, letterSpacing: '-.02em', color: c.tone, fontVariantNumeric: 'tabular-nums' }}>{c.v}</div>
            <div style={{ fontSize: 11, color: '#667085', marginTop: 2, lineHeight: 1.3 }}>{c.l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
