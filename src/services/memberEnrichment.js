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

/**
 * The identity to match WSFY/attention against — CONSISTENT across every surface (payment teaser,
 * dashboard count, WhoIsSearching). Prefers the member's CONFIRMED mapped record name over the account
 * name (which can be a search TARGET from signup), and uses currentUserId() so selfUserId matches the
 * key the mapping was saved under (id/userId/_id/uniqueId + JWT fallback). Pass the auth `user`.
 */
export function getWsfyIdentity(user) {
  const mapped = getMappedIdentity() || {};
  const accountName = [user && user.firstName, user && user.lastName].filter(Boolean).join(' ') || (user && user.name) || '';
  return {
    name: mapped.name || accountName,
    city: mapped.city || (user && (user.city || user.addressCity)) || '',
    state: mapped.state || (user && (user.state || user.addressState)) || '',
    selfUserId: currentUserId() || undefined,
  };
}
// Persist the removal-profile fields (address/DOB/phone) as part of the member's mapped identity — SERVER
// is the source of truth (stored in member_enrichment.attributes), mirrored locally. Captured ONCE on My
// Identity; the opt-out guide + extension only READ it. Returns true if anything was saved.
export async function updateRemovalProfile(fields = {}) {
  const clean = {};
  for (const k of ['address', 'prevAddress', 'dob', 'phone']) {
    const v = fields[k]; if (v != null && String(v).trim() !== '') clean[k] = String(v).trim();
  }
  if (!Object.keys(clean).length) return false;
  updateMappedIdentity(clean); // local mirror
  const userId = currentUserId();
  if (userId) {
    try {
      await fetch(enrichUrl(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
        body: JSON.stringify({ userId, attributes: clean, source: 'removal-profile' }),
      });
    } catch { /* best-effort; local mirror already holds it */ }
  }
  return true;
}

export function updateMappedIdentity(partial) {
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

function personEnrichUrl() { return enrichUrl().replace(/member-enrichment\/?$/, 'enrich-person'); }

/**
 * Augment this member's WSFY network from Enformion PersonSearch (real relatives + address history) so
 * `shared_relative` / `verified_relative` / `past_local` affinities can fire. All the hard gating —
 * corroboration (age/city or it refuses), opt-out, and the retention/persist switch — lives SERVER-side;
 * the server is also fill-only (never overwrites BC-sourced data). Highest value for members with NO
 * self-report (card-capture path), whose relatives/past_locations are otherwise empty.
 *
 * Fires at most ONCE per member: the free tier is 100 searches/mo, so we localStorage-guard on any
 * definitive outcome (enriched, or already-enriched/opted-out) and let soft failures retry later.
 * @param {{name?:string, city?:string, state?:string, age?:number|string}} who  the member's OWN identity
 */
export function enrichViaPersonSearch(who = {}) {
  const userId = currentUserId();
  if (!userId) return;
  const parts = String(who.name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return;               // need first + last to search
  if (!who.city && !who.age) return;          // no corroboration signal → server would refuse anyway
  const guard = `enformionEnriched:${userId}`;
  try { if (localStorage.getItem(guard)) return; } catch { /* ignore */ }
  try {
    fetch(personEnrichUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
      body: JSON.stringify({
        userId, firstName: parts[0], lastName: parts[parts.length - 1],
        city: who.city || undefined, state: who.state || undefined, age: who.age || undefined,
      }),
    })
      .then((r) => r.json()).then((d) => {
        // Only permanently guard on a settled outcome — let not_configured/ambiguous/no_db retry later.
        if (d && (d.enriched || d.reason === 'already_enriched' || d.reason === 'opted_out')) {
          try { localStorage.setItem(guard, '1'); } catch { /* ignore */ }
        }
      }).catch(() => { /* best-effort */ });
  } catch { /* fetch unavailable */ }
}

/**
 * Store the member's OWN form-provided identity info (owner 2026-07-16) so WSFY has a name to match
 * on even when they never map an identity. Persisted under `attributes` (merged server-side), keyed
 * by the member's userId. WSFY hierarchy: mapped self-identify > cardName > providedName. Never send
 * the search-target name here — only the member's own (cardholder / self-entered) name.
 * @param {object} info  { cardName, cardCity, cardState, providedName, providedCity, providedState }
 */
export function saveIdentityFormInfo(info = {}) {
  const userId = currentUserId();
  if (!userId) return;
  const attributes = {};
  const clean = (v) => (v == null ? '' : String(v).trim());
  if (clean(info.cardName)) attributes.cardName = clean(info.cardName);
  if (clean(info.cardCity)) attributes.cardCity = clean(info.cardCity);
  if (clean(info.cardState)) attributes.cardState = clean(info.cardState).toUpperCase();
  if (clean(info.providedName)) attributes.providedName = clean(info.providedName);
  if (clean(info.providedCity)) attributes.providedCity = clean(info.providedCity);
  if (clean(info.providedState)) attributes.providedState = clean(info.providedState).toUpperCase();
  if (!Object.keys(attributes).length) return;
  post({ userId, attributes, source: 'form-capture' });
  // Members captured here typically have NO self-report → empty relatives/past_locations. Augment from
  // Enformion PersonSearch (server-gated, fill-only, once). Prefer the card identity (city corroborates).
  enrichViaPersonSearch({
    name: attributes.cardName || attributes.providedName,
    city: attributes.cardCity || attributes.providedCity,
    state: attributes.cardState || attributes.providedState,
  });
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
    if (data && data.identity) {
      // Merge into the mirror and return the MERGED result — never the raw server object. The server
      // row can lag the client mirror on fields stored client-side (e.g. `verified`); returning the raw
      // response would clobber them to null (this is what zeroed the Protection Score for verified users).
      updateMappedIdentity(data.identity);
      return getMappedIdentity();
    }
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
export function computeExposure(id, hiddenKeys, breach) {
  if (!id) return null;
  const hidden = new Set(hiddenKeys || []);
  const breachCount = (breach && breach.count) || 0;
  const breachClasses = (breach && (breach.topDataClasses || breach.topClasses)) || [];
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
    // Data breaches (HIBP) — the member's email in known breaches. High severity (leaked passwords/PII).
    { key: 'breaches', present: breachCount > 0, points: Math.min(25, 8 + breachCount * 4), label: 'Data breaches',
      detail: `Your email appears in ${breachCount} known breach${breachCount === 1 ? '' : 'es'}${breachClasses.length ? `, exposing ${breachClasses.slice(0, 2).join(' & ').toLowerCase()}` : ''}.` },
  ];
  const present = rows.filter((r) => r.present);
  const breakdown = present.filter((r) => !hidden.has(r.key)); // hidden drivers drop out of the score
  const hiddenItems = present.filter((r) => hidden.has(r.key));
  const score = Math.min(100, breakdown.reduce((s, r) => s + r.points, 0));
  const level = score >= 65 ? 'High' : score >= 35 ? 'Medium' : score > 0 ? 'Low' : 'Minimal';
  return { count: breakdown.length, score, level, items: breakdown.map((r) => r.label), breakdown, hidden: hiddenItems };
}

/**
 * Protection Score (0-100) — a single glanceable measure of how protected the member's identity is,
 * composited from PROTECTIVE ACTIONS (not just low data), so it climbs as they act:
 *   - Verification (30%): ID-verified > KBA > unverified
 *   - Exposure hidden (40%): the share of exposed details they've hidden
 *   - Activity control (30%): hidden on our surfaces (WSFY suppression)
 * Returns null when the identity isn't claimed yet. { score, level, actions[] }.
 */
export function computeProtectionScore(id, opts = {}) {
  if (!id || !(id.confirmed || id.name || id.hasReport)) return null;
  const exp = computeExposure(id, opts.hiddenFields) || { breakdown: [], hidden: [] };
  const verif = id.verified === 'id' ? 100 : id.verified === 'kba' ? 60 : 0;
  const present = (exp.breakdown ? exp.breakdown.length : 0);
  const hidden = (exp.hidden ? exp.hidden.length : 0);
  const totalDrivers = present + hidden;
  const expHidden = totalDrivers === 0 ? 100 : Math.round((hidden / totalDrivers) * 100);
  const control = opts.suppressed ? 100 : 0;
  const score = Math.max(0, Math.min(100, Math.round(0.30 * verif + 0.40 * expHidden + 0.30 * control)));
  const level = score >= 80 ? 'Strong' : score >= 50 ? 'Fair' : score >= 25 ? 'Building' : 'At risk';
  // The three protective steps, in the intended sequence (verify → hide exposed → control activity).
  // done = that step is complete; the stepper renders these connected end-to-end.
  const steps = [
    {
      key: 'verify', num: 1, done: !!id.verified,
      label: id.verified === 'id' ? 'Identity verified'
        : id.verified === 'kba' ? 'Verify with your ID' : 'Verify your identity',
      points: id.verified === 'kba' ? 12 : 30,
    },
    {
      key: 'expose', num: 2, done: present === 0,
      label: present > 0 ? `Hide ${present} exposed detail${present === 1 ? '' : 's'}` : "What's exposed is hidden",
      points: 40,
    },
    {
      key: 'control', num: 3, done: !!opts.suppressed,
      label: opts.suppressed ? 'Activity hidden' : 'Hide your activity on IDLookup',
      points: 30,
    },
  ];
  const nextStep = steps.find((s) => !s.done) || null;
  return { score, level, steps, nextStep, actions: steps.filter((s) => !s.done) };
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
function exposureUrl() { return enrichUrl().replace(/member-enrichment\/?$/, 'exposure'); }
function optoutUrl() { return enrichUrl().replace(/member-enrichment\/?$/, 'optout'); }

/** "Remove for me" — authorize IDLookup to request removal on the member's behalf across the given sources.
 *  Runs our own opt-out engine (build-the-head); marks each node optout_requested. Requires consent (the
 *  authorized-agent authorization) + a claimed identity (the backend gates on both). Returns { results,
 *  nodes, summary } or { error }. */
export async function runOptOut({ sourceKeys, consent = true } = {}) {
  const userId = currentUserId();
  if (!userId || !Array.isArray(sourceKeys) || !sourceKeys.length) return null;
  let identity = {};
  try {
    const id = getMappedIdentity() || {};
    let email = '';
    try { const u = JSON.parse(localStorage.getItem('user') || 'null'); email = (u && u.email) || ''; } catch { /* ignore */ }
    identity = {
      firstName: id.firstName, middleName: id.middleName, lastName: id.lastName,
      name: id.name || [id.firstName, id.lastName].filter(Boolean).join(' ').trim(),
      city: id.city, state: id.state, age: id.age,
      // email = reply-to for agent-sent requests; address/dob complete the CCPA request when captured.
      email: email || id.email, address: id.address, prevAddress: id.prevAddress, dob: id.dob,
    };
  } catch { /* ignore */ }
  try {
    const res = await fetch(optoutUrl(), {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
      body: JSON.stringify({ userId, sourceKeys, consent: !!consent, identity }),
    });
    if (!res.ok) return { error: res.status };
    return await res.json();
  } catch { return { error: 'network' }; }
}

const EMPTY_GRAPH = { nodes: [], registry: [], annotations: [], summary: { score: 0, found: 0, controlled: 0, inProgress: 0, exposed: 0 } };

/** Fetch the member's Exposure Graph — { nodes, registry, summary }. The spine of the "footprint across
 *  the web" view. Federates our owned surfaces server-side (IDLookup suppression + breach monitor).
 *  Safe empty shape on any failure. See docs/product/exposure-graph-spine.md. */
export async function fetchExposureGraph() {
  const userId = currentUserId();
  if (!userId) return EMPTY_GRAPH;
  let email = '';
  try { const u = JSON.parse(localStorage.getItem('user') || 'null'); email = (u && u.email) || ''; } catch { /* ignore */ }
  try {
    const qs = new URLSearchParams({ userId });
    if (email) qs.set('email', email);
    const res = await fetch(`${exposureUrl()}?${qs.toString()}`, { headers: { ...appKeyHeaders() } });
    if (!res.ok) return EMPTY_GRAPH;
    const data = await res.json();
    return { nodes: data.nodes || [], registry: data.registry || [], annotations: data.annotations || [], summary: data.summary || EMPTY_GRAPH.summary };
  } catch { return EMPTY_GRAPH; }
}

/** Owner Voice — add the owner's context to a record/exposure. Confirmed-owner-gated server-side.
 *  Target is flexible: a graph node (nodeId), a report record (recordKey), or a free label. */
export async function addOwnerNote({ nodeId, recordKey, label, note }) {
  const userId = currentUserId();
  if (!userId || !note) return null;
  // Attach the owner's own identity so the note can be found on their PUBLIC record by a viewer.
  let name = '', state = '';
  try {
    const id = getMappedIdentity();
    if (id) { name = id.name || [id.firstName, id.lastName].filter(Boolean).join(' ').trim(); state = id.state || ''; }
  } catch { /* ignore */ }
  try {
    const res = await fetch(exposureUrl(), {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
      body: JSON.stringify({ userId, action: 'annotate', nodeId, recordKey, label, note, name, state }),
    });
    if (!res.ok) return null;
    return await res.json(); // { ok, moderation, annotations }
  } catch { return null; }
}

/** PUBLIC read: approved owner notes to display on a SEARCHED person's record/report. Keyed by the
 *  subject's identity (name + optional state). Empty for the vast majority (only claimed+UGC records). */
export async function fetchApprovedNotes({ name, state }) {
  if (!name) return [];
  try {
    const qs = new URLSearchParams({ notesForName: name });
    if (state) qs.set('notesForState', state);
    const res = await fetch(`${exposureUrl()}?${qs.toString()}`, { headers: { ...appKeyHeaders() } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.notes || [];
  } catch { return []; }
}

/** Delete one of the owner's own notes. */
export async function deleteOwnerNote(id) {
  const userId = currentUserId();
  if (!userId || !id) return null;
  try {
    const res = await fetch(exposureUrl(), {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
      body: JSON.stringify({ userId, action: 'delete_annotation', id }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

/** Record a per-node control change. Target either an existing node (nodeId) OR a catalog source with
 *  no node yet (sourceKey + surfaceType — e.g. the member clicked "Remove" on Spokeo before any scan;
 *  the backend creates + marks the node so their manual opt-out is tracked). Returns the updated graph. */
export async function setExposureControl({ nodeId, sourceKey, surfaceType, controlStatus, controlMethod }) {
  const userId = currentUserId();
  if (!userId || !controlStatus || !(nodeId || (sourceKey && surfaceType))) return null;
  try {
    const res = await fetch(exposureUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
      body: JSON.stringify({ userId, nodeId, sourceKey, surfaceType, controlStatus, controlMethod: controlMethod || null }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchSuppression() {
  const userId = currentUserId();
  const empty = { activityHidden: false, hiddenFields: [], dispositions: {} };
  if (!userId) return empty;
  try {
    const res = await fetch(`${suppressionUrl()}?userId=${encodeURIComponent(userId)}`, { headers: { ...appKeyHeaders() } });
    if (!res.ok) return empty;
    const d = await res.json();
    return { activityHidden: !!(d && d.suppressed), hiddenFields: (d && d.hiddenFields) || [], dispositions: (d && d.dispositions) || {} };
  } catch { return empty; }
}

// Persist a My Profile module's Protect/Promote disposition ('protect' | 'promote' | 'neutral').
// Returns the updated dispositions map, or null on failure.
export async function setModuleDisposition(module, disposition, meta = {}) {
  const userId = currentUserId();
  if (!userId || !module) return null;
  try {
    const res = await fetch(suppressionUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
      body: JSON.stringify({ userId, module, disposition, name: meta.name, state: meta.state }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return (d && d.dispositions) || {};
  } catch { return null; }
}

export async function setSuppression(on, meta = {}) {
  const userId = currentUserId();
  if (!userId) return false;
  try {
    const res = await fetch(suppressionUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
      // age (from the claimed identity) lets the server suppress the member's PUBLIC record precisely
      // (name+state+age±1) — without it, "Hide me" stays WSFY-only (never over-suppresses a same-name stranger).
      body: JSON.stringify({ userId, on: !!on, name: meta.name, state: meta.state, age: meta.age }),
    });
    return res.ok;
  } catch { return false; }
}

// Record how the member's identity mapping was verified ('kba' | 'id'). Updates the local mirror and
// best-effort POSTs it (a verified-only upsert COALESCE-preserves all other enrichment fields).
export function setVerifiedLevel(level) {
  if (!level) return;
  updateMappedIdentity({ verified: level });
  const userId = currentUserId();
  if (!userId) return;
  post({ userId, verified: level, source: 'verify' });
}

// Per-item "hide this" — suppress a single exposure driver (location/past/relatives/employment/
// education/report). Returns the updated hiddenFields array, or null on failure.
export async function setFieldSuppression(key, on, meta = {}) {
  const userId = currentUserId();
  if (!userId || !key) return null;
  try {
    const res = await fetch(suppressionUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...appKeyHeaders() },
      body: JSON.stringify({ userId, key, on: !!on, name: meta.name, state: meta.state }),
    });
    if (!res.ok) return null;
    const d = await res.json();
    return (d && d.hiddenFields) || [];
  } catch { return null; }
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
    verified: fields.verified, // how the mapping was verified ('kba' | 'id' | undefined)
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
    verified: fields.verified || undefined,
    source: fields.source || 'profile',
  });
}
