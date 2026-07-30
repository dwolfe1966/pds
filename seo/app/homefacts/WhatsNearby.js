'use client';

// "What's nearby" — local entertainment & amenities around an ADDRESS search (?alat=&alng=). Client-only:
// address is URL-only (ISR pages can't read it server-side), and this queries OpenStreetMap's Overpass API by
// radius at runtime from the browser. Renders nothing on non-address visits, while loading, or on failure —
// so it's purely additive and never blocks the page.
import { useEffect, useState } from 'react';

const C = { ink: '#0f2233', body: '#38465a', muted: '#667085', accent: '#12507e', soft: '#f6f9fb', line: '#dce4ec', chip: '#e8f1f8', chipLine: '#cbe0ef' };

// Overpass mirrors — tried in order; first success wins (the primary rate-limits, so we fall through).
const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
// amenity/leisure/shop/transit tag → display category.
const CATEGORY = {
  restaurant: 'Dining', cafe: 'Dining', fast_food: 'Dining', ice_cream: 'Dining', food_court: 'Dining',
  bar: 'Nightlife', pub: 'Nightlife', nightclub: 'Nightlife', biergarten: 'Nightlife',
  cinema: 'Entertainment', theatre: 'Entertainment', arts_centre: 'Entertainment',
  park: 'Parks & recreation', garden: 'Parks & recreation', fitness_centre: 'Parks & recreation', sports_centre: 'Parks & recreation', playground: 'Parks & recreation',
  pharmacy: 'Health', hospital: 'Health', clinic: 'Health', doctors: 'Health',
  supermarket: 'Essentials', convenience: 'Essentials', mall: 'Essentials', bank: 'Essentials', fuel: 'Essentials', library: 'Essentials',
  station: 'Getting around', bus_station: 'Getting around', subway: 'Getting around',
};
const CAT_ORDER = ['Dining', 'Nightlife', 'Entertainment', 'Parks & recreation', 'Health', 'Essentials', 'Getting around'];

function milesBetween(aLat, aLng, bLat, bLng) {
  const R = 3958.8, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

async function fetchNearby(lat, lng) {
  const q = `[out:json][timeout:20];(node["amenity"~"restaurant|cafe|bar|pub|fast_food|nightclub|cinema|theatre|arts_centre|ice_cream|biergarten|pharmacy|hospital|clinic|doctors|bank|fuel|library|bus_station"](around:2400,${lat},${lng});node["leisure"~"park|garden|fitness_centre|sports_centre|playground"](around:2400,${lat},${lng});node["shop"~"supermarket|convenience|mall"](around:2400,${lat},${lng});node["railway"="station"](around:2400,${lat},${lng}););out body 220;`;
  for (const ep of OVERPASS) {
    try {
      const r = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: q, signal: AbortSignal.timeout(12000) });
      if (!r.ok) continue;
      const d = await r.json();
      return d.elements || [];
    } catch { /* try next mirror */ }
  }
  return null; // all mirrors failed
}

export default function WhatsNearby() {
  const [origin, setOrigin] = useState(null);
  const [groups, setGroups] = useState(null); // null=loading/none, {}=loaded

  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const lat = parseFloat(p.get('alat')), lng = parseFloat(p.get('alng'));
      if (Number.isFinite(lat) && Number.isFinite(lng)) setOrigin({ lat, lng });
    } catch { /* none */ }
  }, []);

  useEffect(() => {
    if (!origin) return;
    let alive = true;
    fetchNearby(origin.lat, origin.lng).then((els) => {
      if (!alive || !els) return;
      const g = {};
      for (const e of els) {
        const t = e.tags || {};
        const name = t.name;
        const key = t.amenity || t.leisure || t.shop || (t.railway === 'station' ? 'station' : null);
        const cat = CATEGORY[key];
        if (!name || !cat || e.lat == null) continue;
        (g[cat] ||= []).push({ name, mi: milesBetween(origin.lat, origin.lng, e.lat, e.lon), kind: (key || '').replace(/_/g, ' ') });
      }
      for (const k of Object.keys(g)) {
        const seen = new Set();
        g[k] = g[k].filter((x) => !seen.has(x.name) && seen.add(x.name)).sort((a, b) => a.mi - b.mi).slice(0, 6);
      }
      setGroups(g);
    });
    return () => { alive = false; };
  }, [origin]);

  if (!origin || !groups) return null;
  const cats = CAT_ORDER.filter((c) => groups[c] && groups[c].length);
  if (cats.length === 0) return null;

  return (
    <section style={{ background: '#fff', border: `1px solid ${C.line}`, borderRadius: 14, padding: 'clamp(18px,2.4vw,26px)', marginBottom: 16, boxShadow: '0 1px 2px rgba(15,34,51,.04), 0 8px 26px rgba(15,34,51,.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <span style={{ flex: 'none', width: 38, height: 38, borderRadius: 10, background: C.chip, border: `1px solid ${C.chipLine}`, color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21c4.5-4.5 7-8 7-11a7 7 0 1 0-14 0c0 3 2.5 6.5 7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
        </span>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: C.accent }}>Around here</p>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, letterSpacing: '-.015em', color: C.ink }}>What&apos;s near your address</h2>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {cats.map((cat) => (
          <div key={cat}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.body, marginBottom: 6 }}>{cat}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {groups[cat].map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13.5 }}>
                  <span style={{ flex: 1, minWidth: 0, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  <span style={{ flex: 'none', fontSize: 12, fontWeight: 700, color: C.accent, fontVariantNumeric: 'tabular-nums' }}>{p.mi.toFixed(1)} mi</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '14px 0 0', fontSize: 11.5, color: C.muted }}>Points of interest within ~1.5 miles. Source: OpenStreetMap contributors.</p>
    </section>
  );
}
