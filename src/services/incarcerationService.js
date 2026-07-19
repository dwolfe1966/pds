/**
 * Incarceration/booking lookup — client half. Calls our first-party /api/incarceration on the
 * idlookup.me Vercel server (keys stay server-side), independent of BC. Powers the inmate
 * (/name/landing/v3) experience. Best-effort: any failure returns an empty result so the funnel
 * never breaks, and the teaser simply renders nothing until a data source is live.
 */
/**
 * Age-corroboration for strict (specific-person) matching. `personAge` may be an exact age ("39") OR a
 * RANGE ("35-40") — a plain parseInt would collapse "35-40" to 35 and wrongly wipe a real record at age 40.
 * We corroborate if the record's age falls inside [min-pad, max+pad]. Returns false when either age is unknown.
 */
export function corroboratesAge(recordAge, personAge, pad = 2) {
  if (!Number.isFinite(recordAge)) return false;
  const nums = String(personAge == null ? '' : personAge).match(/\d+/g);
  if (!nums || !nums.length) return false;
  const lo = parseInt(nums[0], 10);
  const hi = nums[1] ? parseInt(nums[1], 10) : lo;
  return recordAge >= lo - pad && recordAge <= hi + pad;
}

/** Normalize the many upstream custody-status vocabularies to a small, clean, user-facing label set. */
export function cleanReleaseStatus(status, recordType) {
  if (recordType === 'court') return 'Court record';
  const s = String(status || '').trim();
  if (!s) return null;
  if (/^in[_\s-]?custody$|incarcerat|^active$|in\s*custody/i.test(s)) return 'In custody';
  if (/releas|discharg|inactive|out\s*of\s*custody/i.test(s)) return 'Released';
  if (/life/i.test(s)) return 'Life sentence';
  if (/parole/i.test(s)) return 'On parole';
  if (/probation/i.test(s)) return 'On probation';
  // A raw date or an already-clean phrase → title-case-ish passthrough, but hide snake_case dev values.
  if (/_/.test(s)) return 'In custody';
  return s;
}

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
