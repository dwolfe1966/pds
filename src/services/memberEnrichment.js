/**
 * WSFY Phase 2b — member enrichment (client side). Populates the growth backend's member_enrichment
 * so a member appears richer when they search others ("Carol King works in healthcare", "went to your
 * high school", "may be a relative"). Two sources feed one endpoint:
 *   1. self-report extraction — from a report the member pulls on THEMSELVES (occupation, relatives).
 *   2. user-provided profile — onboarding/dashboard fields (education, occupation) the report can't give.
 *
 * Independent of BC. PII (occupation/relatives/school) stays server-side, never the analytics dataLayer.
 */
import { extractAll } from '../utils/reportExtract';

function enrichUrl() {
  if (process.env.REACT_APP_MEMBER_ENRICH_URL) return process.env.REACT_APP_MEMBER_ENRICH_URL;
  if (process.env.REACT_APP_LEAD_CAPTURE_URL) {
    return process.env.REACT_APP_LEAD_CAPTURE_URL.replace(/\/leads\/?$/, '/member-enrichment');
  }
  const base = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1';
  return `${base.replace(/\/$/, '')}/member-enrichment`;
}

function currentUserId() {
  // BC's stored user object keys the id inconsistently (id / userId / _id / uniqueId — the login
  // adapter itself detects via `_id || uniqueId`). Check all of them before giving up.
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    const direct = u && String(u.id || u.userId || u._id || u.uniqueId || '');
    if (direct) return direct;
  } catch { /* fall through to token */ }
  // Fallback: derive from the session JWT payload (sub/userId) when the user object lacks any id.
  try {
    const tok = localStorage.getItem('accessToken') || '';
    const parts = tok.split('.');
    if (parts.length === 3) {
      const p = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return String(p.sub || p.userId || p.id || p._id || p.uniqueId || '');
    }
  } catch { /* ignore */ }
  return '';
}

// A local mirror of what we've mapped to this member's identity, so the Account → Identity view can
// display it without a server read. The authoritative copy lives in member_enrichment (server).
const LS_IDENTITY = 'wsfyMappedIdentity';
export function getMappedIdentity() {
  try { return JSON.parse(localStorage.getItem(LS_IDENTITY) || 'null'); } catch { return null; }
}
function updateMappedIdentity(partial) {
  try {
    const cur = getMappedIdentity() || {};
    const next = { ...cur };
    for (const [k, v] of Object.entries(partial)) if (v != null && v !== '') next[k] = v;
    next.mappedAt = new Date().toISOString();
    localStorage.setItem(LS_IDENTITY, JSON.stringify(next));
  } catch { /* ignore */ }
}

// Coarse industry from a job title/employer, for the "works in {industry}" tease. Falls back to
// the title itself when unmapped.
const INDUSTRY = [
  [/nurse|health|medical|hospital|clinic|physician|doctor|dental|pharma|therapist/i, 'healthcare'],
  [/engineer|developer|software|programmer|it |technology|data|devops/i, 'technology'],
  [/teacher|professor|school|educat|tutor|faculty/i, 'education'],
  [/sales|account exec|business dev/i, 'sales'],
  [/finance|account|bank|invest|audit|tax/i, 'finance'],
  [/law|attorney|legal|paralegal/i, 'law'],
  [/construc|contractor|electric|plumb|carpent|weld/i, 'the trades'],
  [/police|fire|military|officer|security/i, 'public safety'],
  [/driver|logistic|transport|truck|delivery/i, 'transportation'],
  [/retail|store|cashier|restaurant|server|hospitality|chef/i, 'retail & hospitality'],
];
function deriveIndustry(title, employer) {
  const hay = `${title || ''} ${employer || ''}`;
  for (const [re, label] of INDUSTRY) if (re.test(hay)) return label;
  return title || null;
}

// App-level auth (WSFY-AUTH interim): a shared key that proves the call came from our app. Not
// per-user; raises the bar against casual scraping. Set REACT_APP_WSFY_APP_KEY (+ WSFY_APP_KEY on
// the backend). Absent → header omitted (backend leaves the gate open until it's configured).
function appKeyHeaders() {
  const k = process.env.REACT_APP_WSFY_APP_KEY;
  return k ? { 'X-App-Key': k } : {};
}

function post(payload) {
  try {
    fetch(enrichUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* best-effort */ });
  } catch { /* fetch unavailable */ }
}

/**
 * Cross-device read of the member's mapped identity from the server, refreshing the local mirror.
 * Returns the identity summary (or null). Keyed on the member's own (opaque) BC userId.
 */
export async function fetchMappedIdentity() {
  const userId = currentUserId();
  if (!userId) return null;
  try {
    const res = await fetch(`${enrichUrl()}?userId=${encodeURIComponent(userId)}`, { headers: { ...appKeyHeaders() } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.identity) { updateMappedIdentity(data.identity); return data.identity; }
    return null;
  } catch { return null; }
}

/**
 * Extract enrichment from a report the member pulled on themselves and send it.
 * @param {object} reportResult  the BC report result (same shape extractAll consumes)
 */
export function enrichFromReport(reportResult, selfPerson) {
  if (!reportResult) return;
  let x;
  try { x = extractAll(reportResult); } catch { return; }
  const job = (x.jobs || [])[0] || {};
  const addrs = x.addresses || [];
  const city = (addrs[0] && addrs[0].city) || (selfPerson && selfPerson.city) || undefined;
  const state = (addrs[0] && addrs[0].state) || (selfPerson && selfPerson.state) || undefined;
  // Prior addresses (address history minus the current) → "once lived in ..." teases.
  const pastLocations = [...new Set(addrs.slice(1).map((a) => [a.city, a.state].filter(Boolean).join(', ')).filter(Boolean))].slice(0, 12);
  // Local mirror FIRST, unconditionally (see saveMemberProfile note) — then best-effort server POST.
  updateMappedIdentity({
    confirmed: true, hasReport: true,
    name: selfPerson && selfPerson.name, age: selfPerson && selfPerson.age, city, state,
    occupation: deriveIndustry(job.title, job.employer), jobTitle: job.title, employer: job.employer,
    relativesCount: (x.relatives || []).length, pastLocationsCount: pastLocations.length,
  });
  const userId = currentUserId();
  if (!userId) return;
  post({
    userId,
    // The CANONICAL, re-fetchable link to the member's own record (unlike the ephemeral extId).
    reportId: reportResult.commerceContentId || undefined,
    selfPerson: selfPerson || undefined,
    occupation: deriveIndustry(job.title, job.employer) || undefined,
    employer: job.employer || undefined,
    relatives: (x.relatives || []).map((r) => r.name).filter(Boolean).slice(0, 40),
    city,
    state,
    pastLocations,
    source: 'self-report',
  });
}

/**
 * Exposure score for the Identity Management product — how public the member's record is, computed
 * from the mapped identity. Higher score = more exposed. { score(0-100), level, count, items[] }.
 */
export function computeExposure(id) {
  if (!id) return null;
  const rows = [
    { key: 'location', present: !!(id.city || id.state), points: 15, label: 'Current location',
      detail: `Your current area${id.city ? ` (${id.city}${id.state ? ', ' + id.state : ''})` : id.state ? ` (${id.state})` : ''} is publicly searchable.` },
    { key: 'past', present: id.pastLocationsCount > 0, points: Math.min(20, (id.pastLocationsCount || 0) * 5), label: 'Address history',
      detail: `${id.pastLocationsCount || 0} prior address${id.pastLocationsCount === 1 ? '' : 'es'} tie you to past locations.` },
    { key: 'relatives', present: id.relativesCount > 0, points: Math.min(20, (id.relativesCount || 0) * 3), label: 'Relatives',
      detail: `${id.relativesCount || 0} relative${id.relativesCount === 1 ? '' : 's'} are linked to your record — a common way people find you.` },
    { key: 'employment', present: !!(id.jobTitle || id.occupation || id.employer), points: 10, label: 'Employment',
      detail: `Your ${[id.jobTitle || id.occupation ? 'occupation' : null, id.employer ? `employer (${id.employer})` : null].filter(Boolean).join(' and ') || 'work history'} is public.` },
    { key: 'education', present: !!(id.highSchool || id.college), points: 10, label: 'Education',
      detail: `Your ${[id.highSchool && 'high school', id.college && 'college'].filter(Boolean).join(' and ')} is tied to your record.` },
    { key: 'report', present: !!id.hasReport, points: 25, label: 'Full public report',
      detail: 'A complete background report — addresses, phones, relatives, records — is available on you.' },
  ];
  const breakdown = rows.filter((r) => r.present);
  const score = Math.min(100, breakdown.reduce((s, r) => s + r.points, 0));
  const level = score >= 65 ? 'High' : score >= 35 ? 'Medium' : score > 0 ? 'Low' : 'Minimal';
  return { count: breakdown.length, score, level, items: breakdown.map((r) => r.label), breakdown };
}

/** Store the canonical report link + confirmed identity, even before/without a full extract. */
export function linkSelfReport(commerceContentId, selfPerson) {
  if (!commerceContentId) return;
  updateMappedIdentity({ confirmed: true, hasReport: true, reportId: commerceContentId,
    name: selfPerson && selfPerson.name, age: selfPerson && selfPerson.age,
    city: selfPerson && selfPerson.city, state: selfPerson && selfPerson.state });
  const userId = currentUserId();
  if (!userId) return;
  post({ userId, reportId: commerceContentId, selfPerson: selfPerson || undefined, source: 'self-identify' });
}

// ── Suppression ("Hide me" — Identity Management) ────────────────────────────
function suppressionUrl() { return enrichUrl().replace(/member-enrichment\/?$/, 'suppression'); }

export async function fetchSuppression() {
  const userId = currentUserId();
  if (!userId) return false;
  try {
    const res = await fetch(`${suppressionUrl()}?userId=${encodeURIComponent(userId)}`, { headers: { ...appKeyHeaders() } });
    if (!res.ok) return false;
    const d = await res.json();
    return !!(d && d.suppressed);
  } catch { return false; }
}

export async function setSuppression(on, meta = {}) {
  const userId = currentUserId();
  if (!userId) return false;
  try {
    const res = await fetch(suppressionUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
      body: JSON.stringify({ userId, on: !!on, name: meta.name, state: meta.state }),
    });
    return res.ok;
  } catch { return false; }
}

/**
 * Save user-provided profile fields (onboarding / dashboard form).
 * @param {object} fields  { occupation, employer, highSchool, college, city, state }
 */
export function saveMemberProfile(fields) {
  if (!fields) return;
  const userId = currentUserId();
  // Local display mirror FIRST, unconditionally — the Identity view must reflect the confirmation
  // even when we can't resolve a server userId (BC's user-object id key varies: _id / uniqueId).
  // Otherwise onComplete → getMappedIdentity() returns null and the confirm form re-renders.
  updateMappedIdentity({
    occupation: fields.occupation, employer: fields.employer,
    highSchool: fields.highSchool, college: fields.college, city: fields.city, state: fields.state,
    name: fields.selfPerson && fields.selfPerson.name, age: fields.selfPerson && fields.selfPerson.age,
    confirmed: fields.selfPerson ? true : undefined,
  });
  if (!userId) return; // no server key → local mirror only (cross-device sync degraded, UI intact)
  post({
    userId,
    occupation: fields.occupation || undefined,
    employer: fields.employer || undefined,
    highSchool: fields.highSchool || undefined,
    college: fields.college || undefined,
    city: fields.city || undefined,
    state: fields.state || undefined,
    reportId: fields.reportId || undefined,
    selfPerson: fields.selfPerson || undefined,
    source: fields.source || 'profile',
  });
}
