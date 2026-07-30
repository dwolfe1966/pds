'use client';

// Active weather alerts (warnings/watches) for an area profile — tornado, flood, heat, winter storm, etc.
// Client-only + additive. Uses the searched address (?alat=&alng=) when present, else the area center. Source:
// NWS (keyless). SELF-GATING: renders nothing when there are no active alerts (the common case) or on failure —
// so it only surfaces when there's genuinely something to warn about.
import { useEffect, useState } from 'react';

const SEV = { Extreme: '#7e2230', Severe: '#b23a48', Moderate: '#d07d2e', Minor: '#c69a2e' };

export default function WeatherAlerts({ center }) {
  const [alerts, setAlerts] = useState(null);

  useEffect(() => {
    let alive = true;
    let lat = center && center.lat, lng = center && center.lng;
    try {
      const p = new URLSearchParams(window.location.search);
      const a = parseFloat(p.get('alat')), b = parseFloat(p.get('alng'));
      if (Number.isFinite(a) && Number.isFinite(b)) { lat = a; lng = b; }
    } catch { /* keep center */ }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    fetch(`https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}`, { headers: { Accept: 'application/geo+json' }, signal: AbortSignal.timeout(9000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const seen = new Set();
        const out = [];
        for (const f of (d.features || [])) {
          const p = f.properties || {};
          if (!p.event || seen.has(p.event)) continue;
          seen.add(p.event);
          out.push({ event: p.event, severity: p.severity, headline: p.headline });
        }
        setAlerts(out.slice(0, 4));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [center]);

  if (!alerts || alerts.length === 0) return null;

  return (
    <div style={{ marginBottom: 16, border: '1px solid #e5b8bf', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '9px 14px', background: '#f8e6e8', borderBottom: '1px solid #e5b8bf', fontSize: 13, fontWeight: 800, color: '#8f2833', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8f2833" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4 2.5 20h19L12 4Z" /><path d="M12 10v4M12 17.5v.5" /></svg>
        Active weather alert{alerts.length > 1 ? 's' : ''}
      </div>
      <div style={{ padding: '4px 14px 12px' }}>
        {alerts.map((a, i) => (
          <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid #f4e0e3' : 0 }}>
            <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: '#fff', background: SEV[a.severity] || '#b23a48', borderRadius: 5, padding: '2px 7px', marginRight: 8 }}>{a.severity || 'Alert'}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f2233' }}>{a.event}</span>
            {a.headline && <div style={{ fontSize: 12.5, color: '#667085', marginTop: 3, lineHeight: 1.4 }}>{a.headline}</div>}
          </div>
        ))}
        <p style={{ margin: '8px 0 0', fontSize: 11.5, color: '#667085' }}>Source: U.S. National Weather Service.</p>
      </div>
    </div>
  );
}
