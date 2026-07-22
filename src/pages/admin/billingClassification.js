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

  // Current cycle REACHED: prefer BC's own schedule sequence (next charge) − 1; fall back to settled
  // count − 1. Verified 2026-07-22 (Tera trial): schedule.sequence=1 (next=S1) → currentCycle 0 = S0.
  const currentCycle = Number.isFinite(nextSeq) ? Math.max(0, nextSeq - 1) : Math.max(0, cyclesBilled - 1);

  const card = cardProfile(order);
  const refunded = orderIsRefunded(order);
  const canceled = isCanceled(order);
  const hasSettled = cyclesBilled > 0;

  let phase, phaseLabel, sCode, hasAccess = false, dunning = false;

  if (!hasSettled) {
    phase = 'payment_failed'; phaseLabel = 'No settled payment'; sCode = '—';
  } else if (refunded && status !== 'active') {
    phase = 'refunded'; phaseLabel = 'Refunded'; sCode = `S${currentCycle}`;
  } else if (status === 'active' && canceled) {
    phase = 'cancelled_active'; phaseLabel = 'Cancelled — access remains'; hasAccess = true;
    sCode = currentCycle === SEQ_TRIAL ? 'S0' : `S${currentCycle}`;
  } else if (status === 'active' && nextRetry > 0) {
    phase = 'dunning'; dunning = true;
    // The failing bill is the pending charge → S{pendingCycle}.{retry}
    const failCycle = nextSeq != null ? nextSeq : currentCycle + 1;
    sCode = `S${failCycle}.${nextRetry}`;
    phaseLabel = failCycle <= 1 ? 'First bill failing — retrying' : `Cycle ${failCycle} bill failing — retrying`;
    hasAccess = true;
  } else if (status === 'active') {
    hasAccess = true;
    if (currentCycle === SEQ_TRIAL) { phase = 'trial'; phaseLabel = 'Trial'; sCode = 'S0'; }
    else { phase = 'subscriber'; phaseLabel = `Subscriber — cycle ${currentCycle}`; sCode = `S${currentCycle}`; }
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
    nextEvent = {
      date: dueTs, amount: nextAmount, cycle: nextSeq, retry: nextRetry, isRetry: nextRetry > 0,
      type: nextRetry > 0 ? 'retry' : (nextSeq === SEQ_TRIAL ? 'trial-charge' : 'renewal'),
    };
  }

  return {
    sCode, phase, phaseLabel, hasAccess, dunning,
    cyclesBilled, currentCycle,
    card, earlyCancel, refunded,
    nextEvent,
    raw: { status, subStatus: lc(order.subStatus), nextSeq, nextRetry, dueTs, nextAmount },
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
