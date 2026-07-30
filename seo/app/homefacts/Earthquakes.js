'use client';

// Recent earthquakes near an area profile (last ~3 years, within ~80 km, magnitude ≥ 2.5). Client-only +
// additive. Uses the searched address (?alat=&alng=) when present, else the area center. Source: USGS
// (keyless). SELF-GATING: renders nothing where there are no recent quakes — so it only appears in seismic
// areas (CA, AK, PNW…), never as an empty module elsewhere.
import { useEffect, useState } from 'react';

const C = { ink: '#0f2233', body: '#38465a', muted: '#667085', line: '#dce4ec' };
function magColor(m) {
  if (m >= 5) return '#b23a48';
  if (m >= 4) return '#d07d2e';
  if (m >= 3) return '#c69a2e';
  return '#8a94a6';
}
const fmtDate = (ms) => { try { return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return ''; } };

export default function Earthquakes({ center }) {
  const [quakes, setQuakes] = useState(null);

  useEffect(() => {
    let alive = true;
    let lat = center && center.lat, lng = center && center.lng;
    try {
      const p = new URLSearchParams(window.location.search);
      const a = parseFloat(p.get('alat')), b = parseFloat(p.get('alng'));
      if (Number.isFinite(a) && Number.isFinite(b)) { lat = a; lng = b; }
    } catch { /* keep center */ }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    const start = new Date(Date.now() - 3 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=${lat}&longitude=${lng}&maxradiuskm=80&starttime=${start}&minmagnitude=2.5&orderby=time&limit=8`;
    fetch(url, { signal: AbortSignal.timeout(9000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setQuakes((d.features || []).map((f) => ({ mag: f.properties.mag, place: f.properties.place, time: f.properties.time })).filter((q) => q.mag != null));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [center]);

  if (!quakes || quakes.length === 0) return null;

  return (
    <section style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: 'clamp(18px,2.4vw,26px)', marginBottom: 16, boxShadow: '0 1px 2px rgba(15,34,51,.04), 0 8px 26px rgba(15,34,51,.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ flex: 'none', width: 38, height: 38, borderRadius: 10, background: '#e8f1f8', border: '1px solid #cbe0ef', color: '#12507e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12h4l2-6 4 12 3-9 2 3h5" /></svg>
        </span>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#12507e' }}>Seismic activity</p>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-.015em', color: C.ink }}>Recent earthquakes nearby</h2>
        </div>
      </div>
      <div>
        {quakes.map((q, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: i ? `1px solid #eef2f6` : 0 }}>
            <span style={{ flex: 'none', width: 42, height: 28, borderRadius: 7, background: magColor(q.mag), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 850 }}>{q.mag.toFixed(1)}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.place}</span>
            <span style={{ flex: 'none', fontSize: 12.5, color: C.muted }}>{fmtDate(q.time)}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 11.5, color: C.muted }}>Magnitude ≥ 2.5 within ~50 miles, last 3 years. Source: U.S. Geological Survey.</p>
    </section>
  );
}
