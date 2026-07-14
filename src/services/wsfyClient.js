/**
 * WSFY ("Who's Searching For You") client — fetches the tiered view for the signed-in member
 * from our growth backend. Free members get an obfuscated tease (names masked SERVER-SIDE);
 * paid members get full detail. Independent of BC.
 */

function wsfyUrl() {
  if (process.env.REACT_APP_WSFY_URL) return process.env.REACT_APP_WSFY_URL;
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) {
    return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '/wsfy');
  }
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
  return `${base.replace(/\/$/, '')}/wsfy`;
}

/**
 * @param {object} p  { name, city, state, selfUserId, tier: 'free'|'paid' }
 * @returns {Promise<{count,tier,teaseSummary:{headline,lines[]},events[]}>}
 */
export async function fetchWhoIsSearching(p) {
  const res = await fetch(wsfyUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p || {}),
  });
  if (!res.ok) throw new Error(`wsfy ${res.status}`);
  return res.json();
}
