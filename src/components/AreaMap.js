import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * AreaMap — an at-a-glance map of a person's city/state, used on the HomeFacts entry experiences to pay off
 * the "where is this offender" intent BEFORE any paid resolve (we only have city+state from the URL params).
 *
 * Geocodes "city, state" client-side via OpenStreetMap Nominatim (cached in sessionStorage), then renders a
 * Leaflet map with OSM tiles + a single pin. SAFE-BY-DEFAULT: if geocoding or tiles fail — or no city is known
 * — it renders a styled location banner instead, so the hero never looks broken.
 *
 * Prod note: OSM tiles + Nominatim must be allowed by the host CSP (tile.openstreetmap.org already needed by
 * AddressMap; add nominatim.openstreetmap.org). For scale, move geocoding server-side (idlookup.me) + cache.
 * Pass `coords={[lat,lng]}` to skip geocoding entirely (e.g. from resolved BC addresses).
 */

function pinIcon(color) {
  const html = `<svg width="30" height="42" viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 22 12 22s12-13.6 12-22C24 5.4 18.6 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>`;
  return L.divIcon({ html, className: 'idl-pin', iconSize: [30, 42], iconAnchor: [15, 42] });
}

async function geocode(city, state) {
  const key = `geo:${city}|${state}`.toLowerCase();
  try {
    const cached = sessionStorage.getItem(key);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }
  const q = new URLSearchParams({ format: 'json', limit: '1', country: 'US' });
  if (city) q.set('city', city);
  if (state) q.set('state', state);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${q.toString()}`, { headers: { Accept: 'application/json' } });
  const json = await res.json();
  if (!Array.isArray(json) || !json.length) throw new Error('no-geo');
  const coords = [parseFloat(json[0].lat), parseFloat(json[0].lon)];
  if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) throw new Error('bad-geo');
  try { sessionStorage.setItem(key, JSON.stringify(coords)); } catch { /* ignore */ }
  return coords;
}

export default function AreaMap({ city, state, coords: coordsProp, label, height = 180, accent = '#0d5d2f' }) {
  const [coords, setCoords] = useState(coordsProp || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (coordsProp || (!city && !state)) return;
    let alive = true;
    geocode(city, state).then((c) => { if (alive) setCoords(c); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [city, state, coordsProp]);

  const locText = label || [city, state].filter(Boolean).join(', ') || 'Location on file';

  // Fallback banner — geocoding failed, or nothing to geocode.
  if (failed || (!coords && (!city && !state))) {
    return (
      <div style={{ height, borderRadius: 12, border: `1px solid ${accent}22`, background: `linear-gradient(135deg, ${accent}0d, ${accent}1a)`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: accent, fontWeight: 700, fontSize: 15 }}>
        <span style={{ fontSize: 22 }} aria-hidden="true">📍</span> {locText}
      </div>
    );
  }

  // Still geocoding — a light placeholder so layout doesn't jump.
  if (!coords) {
    return (
      <div style={{ height, borderRadius: 12, border: '1px solid #e5e7eb', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9aa4ad', fontSize: 13 }}>
        Loading map for {locText}…
      </div>
    );
  }

  return (
    <div style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', position: 'relative' }}>
      <MapContainer center={coords} zoom={11} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} zoomControl={false} attributionControl={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={coords} icon={pinIcon(accent)} />
      </MapContainer>
      <div style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 500, background: 'rgba(255,255,255,0.92)', borderRadius: 8, padding: '4px 9px', fontSize: 12.5, fontWeight: 700, color: '#111827', pointerEvents: 'none' }}>
        📍 {locText}
      </div>
    </div>
  );
}
