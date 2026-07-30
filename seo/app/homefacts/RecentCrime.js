'use client';

// "Recent crime near your address" — incident-level open crime data for the few big metros that publish it
// (see crimeSources.js). Client-only: address is URL-only (ISR-safe), and each city's Socrata portal is queried
// live by a small bounding box around the address. Renders nothing when there's no address, no source for the
// city, or the query fails — purely additive, never blocks the page.
import { useEffect, useState } from 'react';
import { crimeSourceFor } from './crimeSources';

function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.8, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}
const titleCase = (s) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, ' ').trim();
const fmtDate = (s) => { try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };

const C = { ink: '#0f2233', body: '#38465a', muted: '#667085', accent: '#12507e', crit: '#b23a48', line: '#dce4ec', soft: '#f8e6e8', softLine: '#e5b8bf' };

export default function RecentCrime({ stateLc, citySlug, cityName }) {
  const src = crimeSourceFor(stateLc, citySlug);
  const [origin, setOrigin] = useState(null);
  const [rows, setRows] = useState(null);

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const lat = parseFloat(p.get('alat')), lng = parseFloat(p.get('alng'));
      if (Number.isFinite(lat) && Number.isFinite(lng)) setOrigin({ lat, lng });
    } catch { /* none */ }
  }, []);

  useEffect(() => {
    if (!origin || !src) return;
    let alive = true;
    const d = 0.008; // ~0.55 mi box
    const where = `${src.lat}>${(origin.lat - d).toFixed(5)} AND ${src.lat}<${(origin.lat + d).toFixed(5)} AND ${src.lng}>${(origin.lng - d).toFixed(5)} AND ${src.lng}<${(origin.lng + d).toFixed(5)}`;
    const url = `https://${src.domain}/resource/${src.dataset}.json?$where=${encodeURIComponent(where)}&$order=${src.date}%20DESC&$limit=12`;
    fetch(url, { signal: AbortSignal.timeout(12000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d2) => {
        if (!alive || !Array.isArray(d2)) return;
        const out = d2.map((x) => {
          const lat = parseFloat(x[src.lat]), lng = parseFloat(x[src.lng]);
          return { type: titleCase(x[src.type]), date: x[src.date], mi: (Number.isFinite(lat) && Number.isFinite(lng)) ? milesBetween(origin.lat, origin.lng, lat, lng) : null };
        }).filter((x) => x.type && x.date).slice(0, 8);
        setRows(out);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [origin, src]);

  if (!origin || !src || !rows || rows.length === 0) return null;

  return (
    <section style={{ background: '#fff', border: `1px solid ${C.softLine}`, borderRadius: 14, marginBottom: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,34,51,.04), 0 8px 26px rgba(15,34,51,.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 16px', background: C.soft, borderBottom: `1px solid ${C.softLine}`, fontSize: 13, fontWeight: 800, color: '#8f2833' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8f2833" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4M12 17.5v.5" /></svg>
        Recent crime near your address
      </div>
      <div style={{ padding: '6px 16px 14px' }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 0', borderTop: i ? `1px solid #eef2f6` : 0 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 650, color: C.ink }}>{r.type}</span>
            {r.mi != null && <span style={{ flex: 'none', fontSize: 12, color: C.muted, fontVariantNumeric: 'tabular-nums' }}>{r.mi.toFixed(1)} mi</span>}
            <span style={{ flex: 'none', fontSize: 12.5, color: C.muted, minWidth: 92, textAlign: 'right' }}>{fmtDate(r.date)}</span>
          </div>
        ))}
        <p style={{ margin: '12px 0 0', fontSize: 11.5, color: C.muted }}>Most recent reported incidents within ~0.5 miles. Source: {src.label} open data{cityName ? ` (${cityName})` : ''}.</p>
      </div>
    </section>
  );
}
