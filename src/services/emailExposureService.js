/**
 * Email-exposure (breach) lookup — client half. Calls our /api/email-exposure on the idlookup.me Vercel
 * server (HIBP key stays server-side), independent of BC. Powers the "is your email exposed?" flow (E3) —
 * a SELF-CHECK: the visitor enters their own email.
 *
 * Best-effort: any failure (or key unset server-side) returns { available:false } so the funnel degrades to
 * a plain identity-exposure CTA. See seo/lib/emailExposure.mjs.
 */
function endpointUrl() {
  if (process.env.REACT_APP_EMAIL_EXPOSURE_URL) return process.env.REACT_APP_EMAIL_EXPOSURE_URL;
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) {
    return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '/email-exposure');
  }
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
  return `${base.replace(/\/$/, '')}/email-exposure`;
}

const EMPTY = { available: false, breached: false, count: 0, breaches: [], topDataClasses: [], mostRecent: null };

/**
 * @returns {Promise<{available:boolean, breached:boolean, count:number, breaches:Array<{name,date,classes}>, topDataClasses:string[], mostRecent:string|null}>}
 */
export async function fetchEmailExposure(email) {
  const em = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return EMPTY;
  try {
    const res = await fetch(endpointUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: em }),
    });
    if (!res.ok) return EMPTY;
    return await res.json();
  } catch {
    return EMPTY;
  }
}
