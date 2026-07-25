/**
 * Identity monitoring — client half. Two calls, both against the idlookup.me Vercel server:
 *   - syncBreach(email): on-demand breach check for the signed-in member (called when they open My Identity).
 *     Diffs vs last-known, logs identity_events for new findings, returns current exposure + monitoring status.
 *   - getIdentityEvents(email): the member's identity-event feed (for My Activity + the monitoring card).
 *
 * Best-effort: any failure returns a safe empty shape so the identity view never breaks.
 */
function base() {
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '');
  return (process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
}

const EMPTY_SYNC = { available: false, exposure: null, newBreaches: [], firstScan: false, lastChecked: null };

/** @returns {Promise<{available,exposure,newBreaches:string[],firstScan,lastChecked}>} */
export async function syncBreach(email) {
  const em = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return EMPTY_SYNC;
  try {
    const res = await fetch(`${base()}/breach-sync`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em }),
    });
    if (!res.ok) return EMPTY_SYNC;
    return await res.json();
  } catch { return EMPTY_SYNC; }
}

/** @returns {Promise<Array<{id,type,title,detail,data,created_at}>>} */
export async function getIdentityEvents(email, limit = 50) {
  const em = String(email || '').trim();
  if (!em) return [];
  try {
    const res = await fetch(`${base()}/identity-events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, limit }),
    });
    if (!res.ok) return [];
    const d = await res.json();
    return Array.isArray(d.events) ? d.events : [];
  } catch { return []; }
}
