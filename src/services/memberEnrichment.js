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
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u && String(u.id || u.userId || u._id || '');
  } catch { return ''; }
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

function post(payload) {
  try {
    fetch(enrichUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => { /* best-effort */ });
  } catch { /* fetch unavailable */ }
}

/**
 * Extract enrichment from a report the member pulled on themselves and send it.
 * @param {object} reportResult  the BC report result (same shape extractAll consumes)
 */
export function enrichFromReport(reportResult, selfPerson) {
  const userId = currentUserId();
  if (!userId || !reportResult) return;
  let x;
  try { x = extractAll(reportResult); } catch { return; }
  const job = (x.jobs || [])[0] || {};
  const city = (x.addresses && x.addresses[0] && x.addresses[0].city) || (selfPerson && selfPerson.city) || undefined;
  const state = (x.addresses && x.addresses[0] && x.addresses[0].state) || (selfPerson && selfPerson.state) || undefined;
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
    source: 'self-report',
  });
  updateMappedIdentity({
    confirmed: true, hasReport: true,
    name: selfPerson && selfPerson.name, age: selfPerson && selfPerson.age, city, state,
    occupation: deriveIndustry(job.title, job.employer), jobTitle: job.title, employer: job.employer,
    relativesCount: (x.relatives || []).length,
  });
}

/** Store the canonical report link + confirmed identity, even before/without a full extract. */
export function linkSelfReport(commerceContentId, selfPerson) {
  const userId = currentUserId();
  if (!userId || !commerceContentId) return;
  post({ userId, reportId: commerceContentId, selfPerson: selfPerson || undefined, source: 'self-identify' });
  updateMappedIdentity({ confirmed: true, hasReport: true, reportId: commerceContentId,
    name: selfPerson && selfPerson.name, age: selfPerson && selfPerson.age,
    city: selfPerson && selfPerson.city, state: selfPerson && selfPerson.state });
}

/**
 * Save user-provided profile fields (onboarding / dashboard form).
 * @param {object} fields  { occupation, employer, highSchool, college, city, state }
 */
export function saveMemberProfile(fields) {
  const userId = currentUserId();
  if (!userId || !fields) return;
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
  updateMappedIdentity({
    occupation: fields.occupation, employer: fields.employer,
    highSchool: fields.highSchool, college: fields.college, city: fields.city, state: fields.state,
    name: fields.selfPerson && fields.selfPerson.name, age: fields.selfPerson && fields.selfPerson.age,
    confirmed: fields.selfPerson ? true : undefined,
  });
}
