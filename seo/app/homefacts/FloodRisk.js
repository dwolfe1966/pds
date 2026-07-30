'use client';

// FEMA flood risk at a point — the flood zone from the National Flood Hazard Layer. Client-only + additive.
// Uses the searched address (?alat=&alng=) when present, else the area center. Source: FEMA NFHL (keyless
// ArcGIS). Most precise on an address search (a single point); on a city page it's the flood zone at the city
// center. SELF-GATING: renders nothing where the area isn't mapped.
import { useEffect, useState } from 'react';

const C = { ink: '#0f2233', body: '#38465a', muted: '#667085', line: '#dce4ec', soft: '#f6f9fb' };

// FEMA zone + SFHA flag → risk band.
function interpret(zone, sfha, subty) {
  const z = String(zone || '').toUpperCase();
  if (!z && !subty) return null; // unmapped → don't render
  if (sfha === 'T' || /^(A|AE|AH|AO|AR|A99|V|VE)$/.test(z)) {
    const coastal = /^V/.test(z);
    return { level: 'High flood risk', color: '#b23a48', zone: z, desc: `${coastal ? 'Coastal ' : ''}1%-annual-chance (100-year) floodplain — a FEMA Special Flood Hazard Area. Flood insurance is typically required for a mortgage here.` };
  }
  if (subty && /0\.2/.test(subty)) return { level: 'Moderate flood risk', color: '#c69a2e', zone: z || 'X', desc: '0.2%-annual-chance (500-year) flood hazard area.' };
  if (z === 'X') return { level: 'Minimal flood risk', color: '#2e7d52', zone: 'X', desc: 'Outside the mapped 0.2%-annual-chance (500-year) floodplain.' };
  if (z === 'D') return { level: 'Undetermined', color: '#8a94a6', zone: 'D', desc: 'Flood risk has not been determined for this area.' };
  return { level: `FEMA zone ${z}`, color: '#12507e', zone: z, desc: 'Mapped FEMA flood zone.' };
}

export default function FloodRisk({ center }) {
  const [flood, setFlood] = useState(null);
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

    const geom = encodeURIComponent(JSON.stringify({ x: lng, y: lat }));
    const url = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=${geom}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,SFHA_TF&returnGeometry=false&f=json`;
    fetch(url, { signal: AbortSignal.timeout(10000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const a = (d.features && d.features[0] && d.features[0].attributes) || {};
        const res = interpret(a.FLD_ZONE, a.SFHA_TF, a.ZONE_SUBTY);
        if (res) setFlood(res);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [center]);

  if (!flood) return null;

  return (
    <section style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: 'clamp(18px,2.4vw,26px)', marginBottom: 16, boxShadow: '0 1px 2px rgba(15,34,51,.04), 0 8px 26px rgba(15,34,51,.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ flex: 'none', width: 46, height: 46, borderRadius: 12, background: flood.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 15c1.5 0 1.5-1.5 3-1.5S10.5 15 12 15s1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5" /><path d="M3 19c1.5 0 1.5-1.5 3-1.5S10.5 19 12 19s1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5" /><path d="M12 3v7M8.5 6.5 12 10l3.5-3.5" /></svg>
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#12507e' }}>Flood risk {atAddress ? '· your address' : ''}</p>
          <h2 style={{ margin: '2px 0 0', fontSize: 21, fontWeight: 800, letterSpacing: '-.015em', color: flood.color }}>{flood.level}</h2>
        </div>
        <span style={{ flex: 'none', fontSize: 12.5, fontWeight: 800, color: C.body, background: C.soft, border: `1px solid ${C.line}`, borderRadius: 999, padding: '5px 13px' }}>FEMA zone {flood.zone}</span>
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 14, color: C.body, lineHeight: 1.6 }}>{flood.desc}</p>
      <p style={{ margin: '10px 0 0', fontSize: 11.5, color: C.muted }}>Flood zone at this {atAddress ? 'address' : 'location'}. Source: FEMA National Flood Hazard Layer.</p>
    </section>
  );
}
