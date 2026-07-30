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
      <iframe
        title={`Map of ${label || 'area'}`}
        src={src}
        loading="lazy"
        style={{ width: '100%', height, border: 0, display: 'block' }}
      />
    </div>
  );
}
