// ZIP → { city, state } for CSR display. Interim until BC returns city/state on
// the user object (ASK H) — BC today exposes ZIP at best (order billingAddress).
// The 0.9 MB map is behind a dynamic import so it loads once, on demand, as its
// own chunk — never in the main admin bundle. Data © GeoNames, CC BY 4.0.
import { useEffect, useState } from 'react';

let dataPromise = null;

export function lookupZipCity(zip) {
  const z = String(zip || '').trim().slice(0, 5);
  if (!/^\d{5}$/.test(z)) return Promise.resolve(null);
  if (!dataPromise) {
    dataPromise = import('./zipGeo.data.js').then((m) => m.default).catch(() => {
      dataPromise = null; // let a later call retry after a transient chunk-load failure
      return null;
    });
  }
  return dataPromise.then((map) => {
    const v = map?.[z];
    if (!v) return null;
    const [city, state] = v.split('|');
    return { city, state };
  });
}

// "Anaheim, CA" for a ZIP, or '' while loading / when unknown.
export function useZipCity(zip) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    let live = true;
    setLabel('');
    lookupZipCity(zip).then((r) => {
      if (live && r) setLabel(`${r.city}, ${r.state}`);
    });
    return () => { live = false; };
  }, [zip]);
  return label;
}
