import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Address-history map for the profile (report + My Identity). Plots every geocoded address the record
 * carries (IDI addresses include latitude/longitude, passed through by reportExtract). The most-recent
 * address (index 0 / rank 0) is highlighted. Safe-by-default: renders NOTHING when no address has usable
 * coordinates, so contexts without geo data (or a provider that stops sending it) simply show no map.
 *
 * Rendering notes:
 * - Pins are L.divIcon (inline SVG), NOT Leaflet's default marker PNGs — those 404 under bundlers and would
 *   also add external image requests. This keeps the map self-contained (only OSM *tiles* load externally,
 *   and tiles are requested by z/x/y grid, never by a pin's coordinates — no address PII leaves the client).
 * - OpenStreetMap tiles are free + keyless; attribution is required and included below.
 */

// Teardrop pin as an inline-SVG divIcon. color = fill; big = larger (used for the newest address).
function pinIcon(color, big) {
  const w = big ? 30 : 22;
  const h = big ? 42 : 31;
  const html = `<svg width="${w}" height="${h}" viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 22 12 22s12-13.6 12-22C24 5.4 18.6 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="4.5" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html,
    className: 'idl-pin',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 6],
  });
}

const NEWEST = '#0d5d2f'; // brand green — current/most-recent address
const OLDER = '#64748b';  // slate — prior addresses

// Fit the map to all pins once they're known.
function FitBounds({ points }) {
  const map = useMap();
  React.useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 12);
    } else {
      map.fitBounds(points, { padding: [28, 28], maxZoom: 13 });
    }
  }, [map, points]);
  return null;
}

export default function AddressMap({ addresses = [], height = 220, title }) {
  const pins = useMemo(() => (addresses || [])
    .map((a, i) => {
      const lat = Number(a.latitude);
      const lng = Number(a.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
      const label = a.full || [a.street, a.city, a.state, a.zip].filter(Boolean).join(', ')
        || [a.city, a.state].filter(Boolean).join(', ');
      const dates = a.dateRange || [a.firstSeen, a.lastSeen].filter(Boolean).join(' – ');
      return { lat, lng, label, dates, newest: i === 0 };
    })
    .filter(Boolean), [addresses]);

  if (!pins.length) return null;
  const points = pins.map((p) => [p.lat, p.lng]);
  const center = points[0];

  return (
    <div style={{ marginBottom: 12 }}>
      {title && <div style={{ fontSize: 12.5, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>{title}</div>}
      <div style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <MapContainer center={center} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {pins.map((p, i) => (
            <Marker key={i} position={[p.lat, p.lng]} icon={pinIcon(p.newest ? NEWEST : OLDER, p.newest)}>
              <Popup>
                <div style={{ fontSize: 12.5 }}>
                  {p.newest && <div style={{ fontWeight: 800, color: NEWEST, marginBottom: 2 }}>Most recent</div>}
                  <div style={{ fontWeight: 600, color: '#111827' }}>{p.label}</div>
                  {p.dates && <div style={{ color: '#6b7280', marginTop: 2 }}>{p.dates}</div>}
                </div>
              </Popup>
            </Marker>
          ))}
          <FitBounds points={points} />
        </MapContainer>
      </div>
    </div>
  );
}
