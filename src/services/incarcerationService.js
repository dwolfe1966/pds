/**
 * Incarceration/booking lookup — client half. Calls our first-party /api/incarceration on the
 * idlookup.me Vercel server (keys stay server-side), independent of BC. Powers the inmate
 * (/name/landing/v3) experience. Best-effort: any failure returns an empty result so the funnel
 * never breaks, and the teaser simply renders nothing until a data source is live.
 */
function endpointUrl() {
  if (process.env.REACT_APP_INCARCERATION_URL) return process.env.REACT_APP_INCARCERATION_URL;
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) {
    return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '/incarceration');
  }
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
  return `${base.replace(/\/$/, '')}/incarceration`;
}

/** @returns {Promise<{count:number, records:Array}>} */
export async function fetchBookings({ firstName, lastName, state, city, age } = {}) {
  if (!lastName && !firstName) return { count: 0, records: [] };
  try {
    const res = await fetch(endpointUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, state, city, age }),
    });
    if (!res.ok) return { count: 0, records: [] };
    const d = await res.json();
    return { count: (d && d.count) || 0, records: (d && Array.isArray(d.records)) ? d.records : [] };
  } catch { return { count: 0, records: [] }; }
}
