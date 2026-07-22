// Legacy S-code billing-lifecycle classification for the CSR per-customer view.
// Definitions: docs/admin/csr-billing-classification-spec.md (legacy KPI deck + CEO data dictionary).
//
// Lifecycle:  Sale → Trial → Membership(S1,S2,S3+) → Cancel(remaining access → expired)
//   S0        = signup/trial (card + trial fee)
//   S1.0      = survived trial → first monthly bill charged
//   S{n}      = subscriber, cycle n (n monthly bills settled)
//   S{n}.{m}  = dunning: retry m on the cycle-n bill (auto-cancels once retries exhaust)
//   C0/C1     = early cancels (C0 = day-1, C1 = before the first monthly charge)
//
// BC field mapping (all live in the order the client already loads — §3b):
//   order.schedule.data.sequence  → the NEXT charge's cycle number
//   order.schedule.data.retry     → dunning attempt on that pending charge
//   order.schedule.dueTimestamp   → when the next event fires
//   order.schedule.data.totalPrice→ next amount (NEVER hardcode price — legacy figures are stale)
//   settled sale payments         → cycles already billed (current position; fixes the frozen-collected bug)
//
// ⚠️ Sequence indexing (trial = sequence 0, first recurring = sequence 1) matches the doc sample but
//    should be re-confirmed against a LIVE findOrders capture; if BC 1-indexes differently, adjust
//    SEQ_TRIAL only.
import { getOrderCard } from '../../utils/orderCard';
import { orderIsRefunded } from './userState';

const SEQ_TRIAL = 0; // BC sequence value that represents the trial/S0 charge

// Retry cascade rules (legacy business rules). BC's schedule.dueTimestamp overrides the NEXT attempt date;
// these rules supply the "of N" total.
// The retry attempt # is VALIDATED (2026-07-22, godwill: schedule.data.retry=2 alongside two rejected S1
// `sale` attempts). Only maxAttempts is still unconfirmed (10 from the KPI deck "up to 10 times"). Until
// `confirmed:true`, we show the real "Retry N" WITHOUT a fabricated "of N". Flip to true once the owner
// confirms the max (or a live order shows auto-cancel after N).
export const RETRY_RULES = { maxAttempts: 10, confirmed: false };

const lc = (s) => (s || '').toLowerCase();

export function settledSales(order) {
  const cps = Array.isArray(order?.commercePayments) ? order.commercePayments : [];
  return cps.filter((p) => lc(p?.type) === 'sale' && lc(p?.status) === 'fulfilled');
}

function isCanceled(order) {
  return !!(order?.transient?.canceled || lc(order?.subStatus) === 'canceled' || lc(order?.subStatus) === 'cancelled');
}

// cpd — card type (Credit / Prepaid / Debit): the payment-propensity signal (read side of BIN gating).
// BC exposes it DEFINITIVELY at commerceTokens[0].transient.bin.extra.cpd ∈ {credit,prepaid,debit}
// (verified live 2026-07-22 — Tera's prepaid-debit Sutton Bank card). Fall back to bin.type/level.
export function cardProfile(order) {
  const card = getOrderCard(order);
  const tok = (Array.isArray(order?.commerceTokens) && order.commerceTokens[0]) || {};
  const cpdRaw = lc(tok?.transient?.bin?.extra?.cpd || '');
  if (!card && !cpdRaw) return null;
  let cpd = null, label = card?.type || 'Unknown';
  if (cpdRaw === 'prepaid') { cpd = 'P'; label = 'Prepaid'; }
  else if (cpdRaw === 'debit') { cpd = 'D'; label = 'Debit'; }
  else if (cpdRaw === 'credit') { cpd = 'C'; label = 'Credit'; }
  else {
    const type = lc(card?.type || ''); const level = lc(card?.level || '');
    if (level.includes('prepaid') || type.includes('prepaid')) { cpd = 'P'; label = 'Prepaid'; }
    else if (type.includes('debit')) { cpd = 'D'; label = 'Debit'; }
    else if (type.includes('credit')) { cpd = 'C'; label = 'Credit'; }
  }
  return {
    cpd, label,
    brand: card?.brand || tok.type || null,
    last4: card?.last4 || tok.lastDigits || null,
    expiry: card?.expiry || null,
    lowPropensity: cpd === 'P' || cpd === 'D', // prepaid/debit convert worse (owner: BIN-risk gating)
  };
}

// The timestamp an order was cancelled (from the orderHistories transition into a canceled subStatus).
function cancelTimestamp(order) {
  const hist = Array.isArray(order?.orderHistories) ? order.orderHistories : [];
  const cx = hist.find((h) => lc(h?.subStatus) === 'canceled' || lc(h?.subStatus) === 'cancelled');
  const t = cx?.createdAt ? Date.parse(cx.createdAt) : (order?.updatedTimestamp || null);
  return Number.isFinite(t) ? t : null;
}

// C0 = cancel within day 1 of signup; C1 = cancel before the first MONTHLY (S1) charge settled.
// The trial charge counts as 1 settled sale, so "before the first monthly charge" = cyclesBilled < 2.
function earlyCancelCode(order, cyclesBilled, nowMs) {
  if (!isCanceled(order)) return null;   // C0/C1 are cancels
  if (cyclesBilled >= 2) return null;    // a monthly cycle already billed → not a pre-first-charge cancel
  const orderTs = order?.orderTimestamp || order?.createdTimestamp || null;
  const cancelTs = cancelTimestamp(order) || nowMs;
  if (orderTs && cancelTs && (cancelTs - orderTs) <= 24 * 60 * 60 * 1000) return 'C0';
  return 'C1';
}

/**
 * classifyBilling(order, { now }) → the per-customer lifecycle classification for one order.
 * Pure; reads only fields BC already returns. `now` is injectable for testing.
 */
export function classifyBilling(order, { now = Date.now() } = {}) {
  if (!order) return null;
  const status = lc(order.status);
  const settled = settledSales(order);
  const cyclesBilled = settled.length;          // settled sale payments (trial books as 1 — verified 2026-07-22)

  const sch = order.schedule || null;
  const nextSeq = Number.isFinite(sch?.data?.sequence) ? sch.data.sequence : null;
  const nextRetry = Number.isFinite(sch?.data?.retry) ? sch.data.retry : 0;
  const dueTs = Number.isFinite(sch?.dueTimestamp) ? sch.dueTimestamp : null;
  const nextAmount = sch?.data?.totalPrice?.amount ?? null;
  // Current retry attempt = schedule.data.retry — the AUTHORITATIVE counter for the pending charge. Verified
  // live 2026-07-22 (godwill: schedule.retry=2 alongside two rejected S1 `sale` attempts, while
  // transient.sequenced.retry read 0 — so sequenced.retry is NOT the retry count; use it only as a fallback).
  const curRetry = nextRetry > 0
    ? nextRetry
    : (Number.isFinite(order?.transient?.sequenced?.retry) ? order.transient.sequenced.retry : 0);

  const card = cardProfile(order);
  const refunded = orderIsRefunded(order);
  const canceled = isCanceled(order);
  const hasSettled = cyclesBilled > 0;

  // Current cycle REACHED = index of the last CAPTURED charge. A captured payment is ground truth, so the
  // settled-sale count is the authority; schedule.sequence can run AHEAD of reality (an uncaptured S0 whose
  // schedule already points at S1 — the rakim/amyjo/moninoso cluster), so use it only as a fallback when
  // nothing has been captured.
  const currentCycle = hasSettled
    ? Math.max(0, cyclesBilled - 1)
    : (Number.isFinite(nextSeq) ? Math.max(0, nextSeq - 1) : 0);
  // The charge currently being ATTEMPTED = the next UNCAPTURED charge = settled count.
  // 0 = trial/initial (S0), 1 = first monthly (S1), … — NOT schedule.sequence.
  const failCycle = cyclesBilled;

  // Trial OVERSTAYED (owner 2026-07-22, godwill): a captured trial (S0) whose scheduled S1 charge date has
  // already PASSED but is still S0 → the first bill isn't succeeding (past the trial window). Derivable
  // now (dueTimestamp < now) even without the retry-attempt field. Flags it at-risk instead of green S0.
  const trialOverstayed = hasSettled && currentCycle === SEQ_TRIAL && status === 'active' && !canceled
    && Number.isFinite(dueTs) && now > dueTs;

  let phase, phaseLabel, sCode, hasAccess = false, dunning = false;

  if (status === 'active' && canceled) {
    phase = 'cancelled_active'; phaseLabel = 'Cancelled — access remains'; hasAccess = true;
    sCode = currentCycle === SEQ_TRIAL ? 'S0' : `S${currentCycle}`;
  } else if (status === 'active' && curRetry > 0) {
    // DUNNING — checked BEFORE the no-settled case. The big cluster (owner 2026-07-22): an initial trial
    // (S0) payment FAILED but we keep them and keep retrying (ISF cascade). No payment captured yet, but
    // actively retrying the INITIAL charge → S0.x, and the next attempt is the trial/initial charge —
    // never a "full S1 charge". Also covers S1.x+ renewal-bill retries.
    phase = 'dunning'; dunning = true; hasAccess = true;
    sCode = `S${failCycle}.${curRetry}`;
    phaseLabel = failCycle === 0 ? 'Trial/initial charge failed — retrying'
      : failCycle === 1 ? 'First monthly bill failed — retrying'
      : `Cycle ${failCycle} bill failed — retrying`;
  } else if (refunded && status !== 'active') {
    phase = 'refunded'; phaseLabel = 'Refunded'; sCode = hasSettled ? `S${currentCycle}` : '—';
  } else if (status === 'active') {
    hasAccess = true;
    if (!hasSettled) {
      // Active, NOTHING captured (only a $0 'validate', or a failed initial) — the S0-failed cluster.
      // Kept around; BC has typically scheduled the full S1 ($49.98) next. Flag it as at-risk, not a clean
      // paying trial. Verified live 2026-07-22 (rakim: validate $0, schedule seq1 $49.98).
      phase = 'trial'; phaseLabel = 'Trial — initial charge NOT captured'; sCode = 'S0';
    } else if (currentCycle === SEQ_TRIAL) {
      phase = 'trial';
      phaseLabel = trialOverstayed ? 'Trial — first bill (S1) overdue / not succeeding' : 'Trial';
      sCode = 'S0';
    } else {
      phase = 'subscriber'; phaseLabel = `Subscriber — cycle ${currentCycle}`; sCode = `S${currentCycle}`;
    }
  } else if (!hasSettled) {
    phase = 'payment_failed'; phaseLabel = 'No settled payment'; sCode = '—';
  } else if (canceled) {
    phase = 'cancelled_ended'; phaseLabel = 'Cancelled — ended'; sCode = `S${currentCycle}`;
  } else {
    phase = 'expired'; phaseLabel = 'Expired'; sCode = `S${currentCycle}`;
  }

  const earlyCancel = earlyCancelCode(order, cyclesBilled, now);

  // Next expected event. A cancelled-but-active order will NOT bill again — its schedule.dueTimestamp is
  // when ACCESS ENDS, not a charge (verified 2026-07-22: Tera cancelled trial still carries a $49.98
  // sequence-1 schedule). So surface it as access-ends, never as a phantom renewal.
  const canBill = status === 'active' && !canceled;
  let nextEvent = null;
  if (phase === 'cancelled_active' && dueTs) {
    nextEvent = { type: 'access-ends', date: dueTs, amount: null, cycle: null, retry: 0, isRetry: false };
  } else if (canBill && dueTs) {
    const isRetry = curRetry > 0;
    // For a retry, the failing charge is the next UNCAPTURED one (failCycle) — NOT schedule.sequence, which
    // may point ahead (an uncaptured S0 whose schedule reads S1). This is the rakim/amyjo fix.
    const cyc = isRetry ? failCycle : (Number.isFinite(nextSeq) ? nextSeq : failCycle);
    nextEvent = {
      date: dueTs, amount: nextAmount, cycle: cyc, retry: curRetry, isRetry,
      // cyc 0 = the trial/initial charge; cyc 1 = the S0→S1 first bill (converts to subscriber); ≥2 = renewal.
      type: isRetry ? 'retry' : (cyc === SEQ_TRIAL ? 'trial-charge' : cyc <= 1 ? 'first-bill' : 'renewal'),
      // "of N" from the rules; BC's dueTimestamp already gave the next date. (BC full-cascade override, when
      // it ever appears in the schedule, would replace maxAttempts/remaining here.)
      maxAttempts: (isRetry && RETRY_RULES.confirmed) ? RETRY_RULES.maxAttempts : null,
      attemptsRemaining: (isRetry && RETRY_RULES.confirmed) ? Math.max(0, RETRY_RULES.maxAttempts - curRetry) : null,
    };
  }

  // Single unified access-first status (toward the taxonomy simplification, owner 2026-07-22): ONE line
  // that says access / no-access + why. 'grace' = has access but something is wrong/ending (dunning or
  // cancel-at-period-end). NOTE: account-level suspension (BC 'blocked') is NOT visible here (order-only) —
  // the caller must let a suspended account override this to no-access. See getCustomerStatus (planned).
  // 'grace' = has access but at risk: dunning, cancel-at-period-end, OR a trial whose initial charge never
  // captured (the S0-failed cluster — kept around, BC about to attempt the full S1).
  const access = !hasAccess ? 'no'
    : (dunning || phase === 'cancelled_active' || (phase === 'trial' && !hasSettled) || trialOverstayed) ? 'grace'
    : 'yes';
  const accessLabel = access === 'yes' ? 'Has access' : access === 'grace' ? 'Has access (at risk)' : 'No access';
  const statusLine = `${accessLabel} · ${phaseLabel}${sCode !== '—' ? ` · ${sCode}` : ''}`;

  return {
    sCode, phase, phaseLabel, hasAccess, dunning, trialOverstayed, access, accessLabel, statusLine,
    cyclesBilled, currentCycle,
    card, earlyCancel, refunded,
    nextEvent,
    raw: { status, subStatus: lc(order.subStatus), nextSeq, nextRetry, dueTs, nextAmount },
  };
}

// getCustomerStatus(user, orders) — the SINGLE access-first status (taxonomy redesign, owner 2026-07-22):
// one answer to "does this customer have access, and why". Folds the account axis (BC 'blocked' → no
// access, overrides billing) and picks the authoritative order (active, else most recent). Replaces the
// old two-axis account-status + plan-status + loose S-code.
//   access: 'yes' (active/healthy) | 'grace' (has access but at-risk/ending) | 'no'
export function getCustomerStatus(user, orders) {
  const list = Array.isArray(orders) ? orders : [];
  const acct = lc(user?.status || user?.transient?.status || '');
  const suspended = acct === 'blocked' || acct === 'suspended' || acct === 'banned';
  const primary = list.find((o) => lc(o?.status) === 'active') || list[0] || null;
  const billing = primary ? classifyBilling(primary) : null;

  // Suspension overrides billing — a blocked account has no access regardless of subscription state.
  if (suspended) {
    return { access: 'no', tone: 'suspended', accessLabel: 'No access', reason: 'Suspended (account blocked)',
      sCode: billing?.sCode ?? null, nextEvent: null, billing };
  }
  if (!billing) {
    return { access: 'no', tone: 'none', accessLabel: 'No access', reason: list.length ? 'No settled payment' : 'Signup only (no orders)',
      sCode: null, nextEvent: null, billing: null };
  }
  return {
    access: billing.access, tone: billing.phase, accessLabel: billing.accessLabel,
    reason: billing.phaseLabel, sCode: billing.sCode, nextEvent: billing.nextEvent, billing,
  };
}

// Merged, newest-first billing event timeline from orderHistories (status transitions) + payments.
export function billingTimeline(order) {
  const events = [];
  const hist = Array.isArray(order?.orderHistories) ? order.orderHistories : [];
  for (const h of hist) {
    events.push({
      kind: 'status',
      ts: h?.createdAt ? Date.parse(h.createdAt) : null,
      status: lc(h?.status), subStatus: lc(h?.subStatus), reason: h?.statusReason || null,
      by: h?.updaterName || null,
    });
  }
  const cps = Array.isArray(order?.commercePayments) ? order.commercePayments : [];
  for (const p of cps) {
    events.push({
      kind: 'payment',
      ts: p?.createdTimestamp || (p?.createdAt ? Date.parse(p.createdAt) : null),
      type: lc(p?.type), pstatus: lc(p?.status),
      amount: p?.transient?.amount?.total ?? p?.amount ?? null,
      decline: p?.subStatus || p?.gatewayTransactionSubStatus || null,
    });
  }
  return events.filter((e) => Number.isFinite(e.ts)).sort((a, b) => b.ts - a.ts);
}
