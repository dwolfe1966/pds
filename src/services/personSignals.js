/**
 * getPersonSignals — the unified, subject-keyed signals engine (Phase 0 of the signals-augmentation plan;
 * see docs/design/2026-07-19-signals-{augmentation,implementation-plan}.md).
 *
 * ONE place that computes every record signal about a person and enforces every invariant, so surfaces stop
 * each doing their own fetch + flow check. Presence is data-driven (what we can safely surface); emphasis is
 * flow-driven (what leads). Two independent axes:
 *   - stage: 'pre-signup' | 'post-pay'  → WHICH signals are computed (cheap/cached vs. sensitive)
 *   - viewerRelation: 'prospect' | 'member-other' | 'owner-self' → gating/framing + suppression role
 *
 * Invariants enforced here (not scattered across JSX):
 *   - sex-offender & criminal are POST-PAY only, and sex-offender is age±1+gender+state corroborated (empty-and-safe)
 *   - a suppressed/opted-out subject yields NO signals (single choke point — currently a stub, see TODO)
 *   - pre-signup = cheap/fast/cached providers only; booking pre-signup gated on display permission
 *
 * SHIPPED DARK in Phase 0: nothing imports this yet. Surfaces are ported behind REACT_APP_SIGNALS_AUGMENT in
 * later phases (SERP → SUP/Payment → landing → post-pay), with the old teasers kept live until augment is proven.
 */
import { fetchLifeEvents } from './lifeEventsService';
import { fetchBookings, corroboratePerson } from './incarcerationService';

// Emphasis config (design §6). Flow picks the lead + capped secondary; owner-self orders by exposure severity.
const FLOW_PRIORITY = {
  inmate:  { lead: 'booking',         secondary: ['marriageDivorce'] },
  divorce: { lead: 'marriageDivorce', secondary: ['booking'] },
  dating:  { lead: 'capability',      secondary: ['marriageDivorce', 'booking'] },
  death:   { lead: 'marriageDivorce', secondary: [] },
  general: { lead: '__strongest__',   secondary: ['__rest__'] },
};
const STRENGTH_ORDER = ['booking', 'sexOffender', 'marriageDivorce']; // for general '__strongest__'
const OWNER_SELF_ORDER = ['sexOffender', 'booking', 'marriageDivorce']; // most-damaging-to-you first
const MAX_SECONDARY = 3;

// Flags read LAZILY (so tests/env can toggle without reimport). Default OFF = today's behavior.
const augmentOn = () => process.env.REACT_APP_SIGNALS_AUGMENT === '1';
const bookingPreSignupOn = () => process.env.REACT_APP_SIGNALS_BOOKING_PRESIGNUP === '1';

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
const subjectKey = (s) => [norm(s.firstName), norm(s.lastName), norm(s.state), norm(s.age)].join(':');

// Memoize RAW signals per (subjectKey, stage) — NOT flow (a person's fetched records don't change with the
// funnel intent). lead/secondary are resolved OUTSIDE the memo (they're flow-dependent). Stores the in-flight
// promise so concurrent surfaces dedupe to one fetch.
const _raw = new Map();
export function _resetSignalsCache() { _raw.clear(); }

async function rawSignals(subject, stage) {
  const key = `${stage}|${subjectKey(subject)}`;
  if (_raw.has(key)) return _raw.get(key);
  const p = _computeRaw(subject, stage).catch(() => ({ marriageDivorce: [], sexOffenderRaw: [], booking: [] }));
  _raw.set(key, p);
  return p;
}

async function _computeRaw(subject, stage) {
  const { firstName, lastName, state, city, age, gender } = subject;
  const wantSO = stage === 'post-pay'; // sex-offender is POST-PAY only (never a pre-signup call — ~10s + harm)
  const [life, booking] = await Promise.all([
    fetchLifeEvents({ firstName, lastName, state, city, age, gender, sexOffender: wantSO }),
    fetchBookings({ firstName, lastName, state, city, age }),
  ]);
  const lifeRecords = (life && life.records) || [];
  return {
    marriageDivorce: lifeRecords.filter((r) => r.recordType === 'divorce' || r.recordType === 'marriage'),
    sexOffenderRaw: lifeRecords.filter((r) => r.recordType === 'sex-offender'),
    booking: (booking && booking.records) || [],
  };
}

// Shape raw → exposed signals per stage. This is where the stage/harm gate bites.
function shapeSignals(raw, { stage, subject }) {
  const signals = { capability: { available: true } };
  signals.marriageDivorce = { records: raw.marriageDivorce, count: raw.marriageDivorce.length };

  // Booking: post-pay always; pre-signup only when display permission is confirmed (flag).
  const bookingVisible = stage === 'post-pay' || bookingPreSignupOn();
  signals.booking = bookingVisible
    ? { records: raw.booking, count: raw.booking.length }
    : { records: [], count: 0 };

  // Sex-offender: POST-PAY only, and TIGHT-corroborated to this person (age±1 + gender + state). Empty-and-safe.
  if (stage === 'post-pay') {
    const so = raw.sexOffenderRaw.filter((r) => corroboratePerson(r, { age: subject.age, gender: subject.gender }));
    signals.sexOffender = { records: so, count: so.length };
  } else {
    signals.sexOffender = { records: [], count: 0 };
  }
  return signals;
}

const present = (signals, k) => (k === 'capability' ? true : ((signals[k] && signals[k].count) || 0) > 0);

// Resolve lead + capped secondary. AUGMENT off → lead only (parity mode). owner-self → severity order.
function resolveEmphasis(signals, { flow, viewerRelation }) {
  if (viewerRelation === 'owner-self') {
    const ranked = OWNER_SELF_ORDER.filter((k) => present(signals, k));
    return { lead: ranked[0] || 'capability', secondary: augmentOn() ? ranked.slice(1, 1 + MAX_SECONDARY) : [] };
  }
  const cfg = FLOW_PRIORITY[flow] || FLOW_PRIORITY.general;
  let lead = cfg.lead;
  if (lead === '__strongest__') lead = STRENGTH_ORDER.find((k) => present(signals, k)) || 'capability';
  if (!present(signals, lead)) lead = 'capability'; // configured lead has no data → fall back to the capability tease
  if (!augmentOn()) return { lead, secondary: [] }; // parity: single-signal, no augmentation
  const secondary = cfg.secondary
    .flatMap((s) => (s === '__rest__'
      ? Object.keys(signals).filter((k) => k !== lead && k !== 'capability' && present(signals, k))
      : (s !== lead && present(signals, s) ? [s] : [])))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, MAX_SECONDARY);
  return { lead, secondary };
}

// Suppression: the single choke point (invariant #5). A suppressed/opted-out subject → no signals anywhere.
// TODO(subject-opt-out, plan gate): wire a SUBJECT-level opt-out lookup (a non-member subject's opt-out, distinct
// from a member's own /api/suppression). Until that store is confirmed queryable, this is a no-op — which is why
// universal augmentation (Phase 5) is gated on resolving it. Enforcement lands HERE when it exists.
async function isSuppressed(/* subject */) { return false; }

/**
 * @param {object} p
 * @param {{firstName?,lastName?,state?,city?,age?,gender?}} p.subject
 * @param {'prospect'|'member-other'|'owner-self'} [p.viewerRelation='prospect']
 * @param {'pre-signup'|'post-pay'} [p.stage]  defaults from viewerRelation
 * @param {'inmate'|'divorce'|'dating'|'death'|'general'} [p.flow='general']
 * @returns {Promise<{suppressed:boolean, lens:string, stage:string, signals:object, lead:string|null, secondary:string[]}>}
 */
export async function getPersonSignals({ subject, viewerRelation = 'prospect', stage, flow = 'general' } = {}) {
  const st = stage || (viewerRelation === 'prospect' ? 'pre-signup' : 'post-pay');
  const base = { suppressed: false, lens: viewerRelation, stage: st, signals: {}, lead: null, secondary: [] };
  if (!subject || (!subject.lastName && !subject.firstName)) return base;
  if (await isSuppressed(subject)) return { ...base, suppressed: true };
  const raw = await rawSignals(subject, st);
  const signals = shapeSignals(raw, { stage: st, subject });
  const { lead, secondary } = resolveEmphasis(signals, { flow, viewerRelation });
  return { suppressed: false, lens: viewerRelation, stage: st, signals, lead, secondary };
}

export { FLOW_PRIORITY };
