'use client';

// Interactive Leaflet map with a pin per registered sex offender (records carry lat/lng). Client-only:
// Leaflet is dynamically imported in an effect (it can't SSR), tiles come from OpenStreetMap, and markers use
// a CSS divIcon (no marker-image path issues). Falls back to nothing if no offender has coordinates — the page
// still shows the plain OSM AreaMap above/elsewhere.
import { useEffect, useRef } from 'react';

export default function OffenderMap({ points, center, height = 340 }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const pts = (points || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (!ref.current || pts.length === 0) return undefined;

    (async () => {
      const L = (await import('leaflet')).default;
      // Inject Leaflet's CSS once (avoids a global-CSS import; CSP on idlookup.me is open).
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      if (cancelled || mapRef.current) return;

      const c = center && Number.isFinite(center.lat) ? [center.lat, center.lng] : [pts[0].lat, pts[0].lng];
      const map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true }).setView(c, 12);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '© OpenStreetMap',
      }).addTo(map);

      const icon = L.divIcon({
        className: '',
        html: '<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;background:#b23a48;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>',
        iconSize: [16, 16], iconAnchor: [8, 16],
      });
      const bounds = [];
      for (const p of pts) {
        const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
        const line = [p.label, p.sub].filter(Boolean).join('<br>');
        if (line) m.bindPopup(`<div style="font-size:13px;line-height:1.4">${line}</div>`);
        bounds.push([p.lat, p.lng]);
      }
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    })();

    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [points, center]);

  const has = (points || []).some((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!has) return null;
  return <div ref={ref} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #dce4ec', zIndex: 0 }} />;
}
