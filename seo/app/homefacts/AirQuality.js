'use client';

// Current air quality (US AQI + PM2.5) for an area profile. Client-only + additive (live data). Uses the
// searched address (?alat=&alng=) when present, else the area center. Source: Open-Meteo Air Quality API
// (keyless, CORS-friendly). Renders nothing until loaded or on failure.
import { useEffect, useState } from 'react';

// EPA AQI category → { label, color } (banded 0-50 / 51-100 / 101-150 / 151-200 / 201-300 / 301+).
function aqiBand(aqi) {
  if (aqi == null) return null;
  if (aqi <= 50) return { label: 'Good', color: '#2e7d52' };
  if (aqi <= 100) return { label: 'Moderate', color: '#c69a2e' };
  if (aqi <= 150) return { label: 'Unhealthy for sensitive groups', color: '#d07d2e' };
  if (aqi <= 200) return { label: 'Unhealthy', color: '#b23a48' };
  if (aqi <= 300) return { label: 'Very unhealthy', color: '#7d3c98' };
  return { label: 'Hazardous', color: '#7e2230' };
}
const C = { ink: '#0f2233', body: '#38465a', muted: '#667085', line: '#dce4ec', soft: '#f6f9fb' };

export default function AirQuality({ center }) {
  const [aq, setAq] = useState(null);

  useEffect(() => {
    let alive = true;
    let lat = center && center.lat, lng = center && center.lng;
    try {
      const p = new URLSearchParams(window.location.search);
      const a = parseFloat(p.get('alat')), b = parseFloat(p.get('alng'));
      if (Number.isFinite(a) && Number.isFinite(b)) { lat = a; lng = b; }
    } catch { /* keep center */ }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,pm2_5,pm10,ozone&timezone=auto`, { signal: AbortSignal.timeout(9000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && d.current && d.current.us_aqi != null) setAq(d.current); })
      .catch(() => {});
    return () => { alive = false; };
  }, [center]);

  if (!aq) return null;
  const band = aqiBand(aq.us_aqi);
  if (!band) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: '13px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
        <span style={{ flex: 'none', width: 46, height: 46, borderRadius: 12, background: band.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, fontWeight: 850 }}>{Math.round(aq.us_aqi)}</span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.muted }}>Air quality (US AQI)</div>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: band.color }}>{band.label}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, marginLeft: 'auto' }}>
        {aq.pm2_5 != null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{Math.round(aq.pm2_5)}</div>
            <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '.03em' }}>PM2.5 µg/m³</div>
          </div>
        )}
        {aq.ozone != null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{Math.round(aq.ozone)}</div>
            <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '.03em' }}>Ozone µg/m³</div>
          </div>
        )}
      </div>
    </div>
  );
}
