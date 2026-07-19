/**
 * Life-events lookup — client half. Calls our first-party /api/life-events (divorce + marriage, and sex-offender
 * when opted in) on the idlookup.me Vercel server (keys server-side), independent of BC. Best-effort: any failure
 * returns an empty result so the funnel never breaks. See docs/design/life-events-data-mapping.md.
 */
function endpointUrl() {
  if (process.env.REACT_APP_LIFE_EVENTS_URL) return process.env.REACT_APP_LIFE_EVENTS_URL;
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) {
    return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '/life-events');
  }
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
  return `${base.replace(/\/$/, '')}/life-events`;
}

/**
 * @param {{firstName?, lastName?, state?, city?, age?, gender?, sexOffender?:boolean}} q
 * @returns {Promise<{count:number, records:Array}>}
 */
export async function fetchLifeEvents({ firstName, lastName, state, city, age, gender, sexOffender } = {}) {
  if (!lastName && !firstName) return { count: 0, records: [] };
  try {
    const res = await fetch(endpointUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, state, city, age, gender, sexOffender: !!sexOffender }),
    });
    if (!res.ok) return { count: 0, records: [] };
    return await res.json();
  } catch { return { count: 0, records: [] }; }
}
