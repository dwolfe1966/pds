'use client';

// Interactive Leaflet map with a pin per registered sex offender (records carry lat/lng). Client-only:
// Leaflet is dynamically imported in an effect (it can't SSR), tiles come from OpenStreetMap, and markers use
// a CSS divIcon (no marker-image path issues). Falls back to nothing if no offender has coordinates — the page
// still shows the plain OSM AreaMap above/elsewhere.
import { useEffect, useRef } from 'react';

// Haversine miles between two lat/lng points.
function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.8, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}
// Address origin from the URL (?alat=&alng=), set by the address-search resolver. Read client-side (ISR pages
// can't read query params server-side). When present, every map on the page positions the address + shows how
// far each pin (offender / school) is from it.
function addressOrigin() {
  try {
    const p = new URLSearchParams(window.location.search);
    const lat = parseFloat(p.get('alat')), lng = parseFloat(p.get('alng'));
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch { return null; }
}

export default function OffenderMap({ points, center, height = 340, color = '#b23a48' }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const origin = addressOrigin();
    const pts = (points || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (!ref.current || (pts.length === 0 && !origin)) return undefined;

    (async () => {
      const L = (await import('leaflet')).default;
      // Inject Leaflet's CSS once — self-hosted (no third-party unpkg render dependency / CSP fragility).
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = '/vendor/leaflet-1.9.4.css';
        document.head.appendChild(link);
      }
      if (cancelled || mapRef.current) return;

      // Center on the searched address when present, else the passed center / first pin.
      const c = origin ? [origin.lat, origin.lng]
        : center && Number.isFinite(center.lat) ? [center.lat, center.lng]
          : [pts[0].lat, pts[0].lng];
      const map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true }).setView(c, origin ? 13 : 12);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, attribution: '© OpenStreetMap',
      }).addTo(map);

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:16px;height:16px;border-radius:50% 50% 50% 0;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);transform:rotate(-45deg)"></div>`,
        iconSize: [16, 16], iconAnchor: [8, 16],
      });
      const bounds = [];
      for (const p of pts) {
        const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
        const dist = origin ? `<div style="color:#12507e;font-weight:700;margin-top:2px">${milesBetween(origin.lat, origin.lng, p.lat, p.lng).toFixed(1)} mi from your address</div>` : '';
        const line = [p.label, p.sub].filter(Boolean).join('<br>') + dist;
        if (line) m.bindPopup(`<div style="font-size:13px;line-height:1.4">${line}</div>`);
        bounds.push([p.lat, p.lng]);
      }
      // Address marker — a distinct blue home pin at the searched address.
      if (origin) {
        const home = L.divIcon({
          className: '',
          html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#12507e;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);color:#fff;font-size:13px">🏠</span></div>',
          iconSize: [26, 26], iconAnchor: [13, 26],
        });
        L.marker([origin.lat, origin.lng], { icon: home, zIndexOffset: 1000 }).addTo(map).bindPopup('<div style="font-size:13px;font-weight:700">Your address</div>');
        bounds.push([origin.lat, origin.lng]);
      }
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [34, 34], maxZoom: origin ? 15 : 14 });
    })();

    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, [points, center]);

  // Container render is deterministic (server + client agree → hydration-safe): show it when there are pins.
  // The address origin enhances any map that renders — centers it, drops a "your address" home pin, and adds
  // "X mi from your address" to each pin's popup.
  const has = (points || []).some((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (!has) return null;
  return <div ref={ref} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid #dce4ec', zIndex: 0 }} />;
}
