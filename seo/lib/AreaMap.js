// AreaMap — a real, interactive neighborhood map for the HomeFacts area profiles. Uses an OpenStreetMap
// embed (iframe) centered on the area, with a marker. Zero dependencies, no API key, no client JS of our own —
// it just works and stays ISR-cacheable. A richer Leaflet map with per-offender pins is the planned fast-follow
// (offender records already carry lat/lng); this establishes the map surface now.
export function AreaMap({ lat, lng, label, zoom = 12, height = 300 }) {
  if (lat == null || lng == null) return null;
  // Degree deltas ~ a few miles at typical US latitudes; smaller box = tighter zoom.
  const dLat = zoom >= 13 ? 0.04 : zoom >= 11 ? 0.09 : 0.18;
  const dLng = dLat * 1.4;
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((n) => n.toFixed(5)).join('%2C');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lng.toFixed(5)}`;
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #dce4ec' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: '#e8f1f8', borderBottom: '1px solid #cbe0ef', fontSize: 12.5, fontWeight: 700, color: '#0c3a5c' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#12507e" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21c4.5-4.5 7-8 7-11a7 7 0 1 0-14 0c0 3 2.5 6.5 7 11Z" /><circle cx="12" cy="10" r="2.5" />
        </svg>
        {label || 'Map'}
      </div>
      <iframe
        title={`Map of ${label || 'area'}`}
        src={src}
        loading="lazy"
        style={{ width: '100%', height, border: 0, display: 'block' }}
      />
    </div>
  );
}
