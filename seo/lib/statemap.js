// Server-rendered SVG dot-map of a state's cities. Pure data → SVG (our own
// Census lat/lng + population), so there's no client JS, no tile server, no API
// key, and each state's map is unique. Cities are circles sized by population;
// the largest are labeled. Linear lat/lng projection with cos(lat) aspect
// correction — plenty accurate at single-state scale.

export function StateMap({ cities = [], name = '', highlight = null, width = 680, height = 430 }) {
  const pts = cities.filter((c) => c.lat && c.lng && c.pop);
  if (pts.length < 3) return null;
  const hi = highlight ? String(highlight).toLowerCase() : null;
  const isHi = (c) => hi && c.city.toLowerCase() === hi;

  const lats = pts.map((c) => c.lat);
  const lngs = pts.map((c) => c.lng);
  let minLat = Math.min(...lats), maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const padLat = (maxLat - minLat) * 0.1 || 0.5;
  const padLng = (maxLng - minLng) * 0.1 || 0.5;
  minLat -= padLat; maxLat += padLat; minLng -= padLng; maxLng += padLng;

  const M = 20;
  const midLat = (minLat + maxLat) / 2;
  const lngScale = Math.cos((midLat * Math.PI) / 180);
  const geoW = (maxLng - minLng) * lngScale;
  const geoH = maxLat - minLat;
  const scale = Math.min((width - 2 * M) / geoW, (height - 2 * M) / geoH);
  const offX = (width - geoW * scale) / 2;
  const offY = (height - geoH * scale) / 2;
  const project = (lat, lng) => [
    offX + (lng - minLng) * lngScale * scale,
    offY + (maxLat - lat) * scale,
  ];

  const maxPop = Math.max(...pts.map((c) => c.pop));
  const radius = (pop) => 2.5 + 11 * Math.sqrt(pop / maxPop);
  const labeled = [...pts].sort((a, b) => b.pop - a.pop).slice(0, 6);
  if (hi && !labeled.some(isHi)) { const h = pts.find(isHi); if (h) labeled.push(h); }
  const labeledCities = new Set(labeled.map((c) => c.city));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`Map of major cities in ${name}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ maxWidth: '100%', height: 'auto', display: 'block', background: '#eef7f1', border: '1px solid #d5e6db', borderRadius: 12 }}>
      {pts.map((c, i) => {
        const [x, y] = project(c.lat, c.lng);
        if (isHi(c)) {
          const r = Math.max(6, radius(c.pop));
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={r + 4} fill="none" stroke="#f59e0b" strokeWidth="2.5" />
              <circle cx={x} cy={y} r={r} fill="#f59e0b" />
            </g>
          );
        }
        return <circle key={i} cx={x} cy={y} r={radius(c.pop)} fill="#0d5d2f" fillOpacity={labeledCities.has(c.city) ? 0.85 : 0.38} />;
      })}
      {labeled.map((c, i) => {
        const [x, y] = project(c.lat, c.lng);
        const rightHalf = x > width / 2;
        return (
          <text key={i} x={rightHalf ? x - radius(c.pop) - 4 : x + radius(c.pop) + 4} y={y + 4}
            fontSize={isHi(c) ? '13.5' : '12.5'} fontWeight="700" fill={isHi(c) ? '#b45309' : '#14532d'}
            textAnchor={rightHalf ? 'end' : 'start'}>{c.city}</text>
        );
      })}
    </svg>
  );
}
