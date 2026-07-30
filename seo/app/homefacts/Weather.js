'use client';

// Current weather for an area profile. Client-only + additive (weather is live, so it can't be SSR/ISR-cached).
// Uses the searched address (?alat=&alng=) when present, else the area's center. Source: Open-Meteo (keyless,
// CORS-friendly). Renders nothing until loaded or on failure.
import { useEffect, useState } from 'react';

// WMO weather code → { label, icon }.
const WMO = {
  0: ['Clear', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'], 48: ['Fog', '🌫️'], 51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Drizzle', '🌦️'],
  61: ['Light rain', '🌧️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'], 66: ['Freezing rain', '🌧️'], 67: ['Freezing rain', '🌧️'],
  71: ['Light snow', '🌨️'], 73: ['Snow', '🌨️'], 75: ['Heavy snow', '🌨️'], 77: ['Snow grains', '🌨️'],
  80: ['Showers', '🌦️'], 81: ['Showers', '🌦️'], 82: ['Heavy showers', '🌧️'], 85: ['Snow showers', '🌨️'], 86: ['Snow showers', '🌨️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm', '⛈️'], 99: ['Thunderstorm', '⛈️'],
};
const C = { ink: '#0f2233', body: '#38465a', muted: '#667085', accent: '#12507e', soft: '#e8f1f8', line: '#cbe0ef' };

export default function Weather({ center }) {
  const [wx, setWx] = useState(null);

  useEffect(() => {
    let alive = true;
    let lat = center && center.lat, lng = center && center.lng;
    try {
      const p = new URLSearchParams(window.location.search);
      const a = parseFloat(p.get('alat')), b = parseFloat(p.get('alng'));
      if (Number.isFinite(a) && Number.isFinite(b)) { lat = a; lng = b; }
    } catch { /* keep center */ }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`, { signal: AbortSignal.timeout(9000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d && d.current) setWx(d.current); })
      .catch(() => {});
    return () => { alive = false; };
  }, [center]);

  if (!wx) return null;
  const [label, icon] = WMO[wx.weather_code] || ['—', '🌡️'];
  const temp = Math.round(wx.temperature_2m);
  const feels = Math.round(wx.apparent_temperature);
  const stat = (v, l) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>{v}</div>
      <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '.03em' }}>{l}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: '13px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 30, lineHeight: 1 }} aria-hidden="true">{icon}</span>
        <div>
          <div style={{ fontSize: 26, fontWeight: 850, letterSpacing: '-.02em', color: C.ink, lineHeight: 1 }}>{temp}°F</div>
          <div style={{ fontSize: 12.5, color: C.body }}>{label}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20, marginLeft: 'auto' }}>
        {stat(`${feels}°`, 'Feels like')}
        {stat(`${Math.round(wx.wind_speed_10m)} mph`, 'Wind')}
        {stat(`${Math.round(wx.relative_humidity_2m)}%`, 'Humidity')}
      </div>
    </div>
  );
}
