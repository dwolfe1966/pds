/**
 * Phone line-safety lookup — client half. Calls our /api/phone-intel on the idlookup.me Vercel server
 * (Twilio keys stay server-side), independent of BC. Returns a DESCRIPTIVE line-safety signal (line type,
 * carrier, risk band) for the reverse-phone "is this call safe?" flow (P2).
 *
 * Best-effort: any failure (or keys unset server-side) returns { available:false } so the funnel degrades to
 * the plain owner reveal. See seo/lib/phoneIntel.mjs for compliance + cost gating.
 */
function endpointUrl() {
  if (process.env.REACT_APP_PHONE_INTEL_URL) return process.env.REACT_APP_PHONE_INTEL_URL;
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) {
    return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '/phone-intel');
  }
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
  return `${base.replace(/\/$/, '')}/phone-intel`;
}

/** @returns {Promise<{available:boolean, valid:boolean|null, lineType:string|null, carrier:string|null, riskLevel:'low'|'elevated'|'unknown'}>} */
export async function fetchPhoneIntel(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return { available: false, lineType: null, carrier: null, riskLevel: 'unknown', valid: null };
  try {
    const res = await fetch(endpointUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: digits }),
    });
    if (!res.ok) return { available: false, lineType: null, carrier: null, riskLevel: 'unknown', valid: null };
    return await res.json();
  } catch {
    return { available: false, lineType: null, carrier: null, riskLevel: 'unknown', valid: null };
  }
}

// Human-friendly, DESCRIPTIVE line-type label + risk framing (never an assertion about the owner).
export function describeLine({ lineType, carrier, riskLevel } = {}) {
  const TYPE = {
    mobile: 'Mobile', landline: 'Landline', fixedVoip: 'VoIP (fixed)', nonFixedVoip: 'VoIP',
    voip: 'VoIP', tollFree: 'Toll-free', premium: 'Premium-rate', personal: 'Personal', unknown: 'Unknown',
  };
  const typeLabel = TYPE[lineType] || (lineType ? lineType : 'Unknown');
  const risk = {
    low: { label: 'Ordinary line', note: 'Typical of a personal mobile or landline.', tone: 'ok' },
    elevated: { label: 'Higher-risk line type', note: 'VoIP & toll-free numbers are commonly used for robocalls and spam.', tone: 'warn' },
    unknown: { label: 'Line type unavailable', note: 'We couldn’t classify this line.', tone: 'muted' },
  }[riskLevel || 'unknown'];
  return { typeLabel, carrier: carrier || null, ...risk };
}
