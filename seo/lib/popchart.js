// Server-rendered SVG population-trend line chart. Pure data → SVG (no client JS, no
// chart lib), from Wikidata historical points (CC0) + the current ACS anchor. Y-axis
// spans padded min→max so the trend shape reads whether the range is centuries
// (NYC 5K→8.8M) or a couple decades (Houston 2.1M→2.3M).

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${n}`);

export function PopChart({ points = [], width = 680, height = 240 }) {
  const pts = points.filter((p) => p.year && p.pop).sort((a, b) => a.year - b.year);
  if (pts.length < 2) return null;

  const M = { t: 16, r: 16, b: 26, l: 54 };
  const iw = width - M.l - M.r, ih = height - M.t - M.b;
  const years = pts.map((p) => p.year), pops = pts.map((p) => p.pop);
  const minY = Math.min(...years), maxY = Math.max(...years);
  let minP = Math.min(...pops), maxP = Math.max(...pops);
  const padP = (maxP - minP) * 0.08 || maxP * 0.1;
  minP = Math.max(0, minP - padP); maxP += padP;

  const x = (yr) => M.l + (maxY === minY ? 0.5 : (yr - minY) / (maxY - minY)) * iw;
  const y = (p) => M.t + (1 - (p - minP) / (maxP - minP || 1)) * ih;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p.pop).toFixed(1)}`).join(' ');
  const area = `${line} L${x(maxY).toFixed(1)},${(M.t + ih).toFixed(1)} L${x(minY).toFixed(1)},${(M.t + ih).toFixed(1)} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img"
      aria-label={`Population from ${minY} to ${maxY}`} preserveAspectRatio="xMidYMid meet"
      style={{ maxWidth: '100%', height: 'auto', display: 'block', background: '#f8faf9', border: '1px solid #e5e7eb', borderRadius: 12 }}>
      <line x1={M.l} y1={M.t} x2={width - M.r} y2={M.t} stroke="#e5e7eb" />
      <line x1={M.l} y1={M.t + ih} x2={width - M.r} y2={M.t + ih} stroke="#e5e7eb" />
      <text x={M.l - 6} y={M.t + 4} fontSize="11" fill="#9ca3af" textAnchor="end">{fmt(Math.round(maxP))}</text>
      <text x={M.l - 6} y={M.t + ih} fontSize="11" fill="#9ca3af" textAnchor="end">{fmt(Math.round(minP))}</text>
      <path d={area} fill="#0d5d2f" fillOpacity="0.08" />
      <path d={line} fill="none" stroke="#0d5d2f" strokeWidth="2.5" />
      {pts.map((p, i) => (
        <circle key={i} cx={x(p.year)} cy={y(p.pop)} r={i === pts.length - 1 ? 4 : 2.3} fill="#0d5d2f" />
      ))}
      <text x={x(last.year)} y={y(last.pop) - 8} fontSize="11.5" fontWeight="700" fill="#14532d" textAnchor="end">{Number(last.pop).toLocaleString('en-US')}</text>
      <text x={M.l} y={height - 8} fontSize="11" fill="#6b7280" textAnchor="start">{minY}</text>
      <text x={width - M.r} y={height - 8} fontSize="11" fill="#6b7280" textAnchor="end">{maxY}</text>
    </svg>
  );
}
