// Shared CSR user-state derivation: plan state + account status, from BC orders.
// Single source of truth so UserDetailPage and the UsersPage list agree.
import api from '../../api';

// Plan state derived from a user's ORDERS (the authority — roles don't carry paid state):
//   Free           — no orders at all (just a signup)
//   Payment failed — orders exist but no payment ever settled (blocked/declined sales;
//                    owner 2026-07-02: split from Free — these are recoverable checkouts)
//   Trial          — active paid order, still in the trial (collected < one full recurring cycle)
//   Subscriber     — active recurring subscription (a full cycle has billed)
//   Cancelled      — set to cancel at period end (subStatus=canceled / transient.canceled)
//   Refunded       — money was returned (refund payment settled / order type=refund).
//                    Display state only — refund does NOT revoke access before dueTimestamp
//                    (owner 2026-07-02); access remains whatever BC enforces.
//   Expired        — subscription ended (subStatus=expired) or no active paid order remains
export const PLAN_STATES = {
  free:           { key: 'free',           label: 'Free',           color: '#374151', bg: '#e5e7eb' },
  payment_failed: { key: 'payment_failed', label: 'Payment failed', color: '#7c2d12', bg: '#fef2f2' },
  trial:          { key: 'trial',          label: 'Trial',          color: '#92400e', bg: '#fef3c7' },
  subscriber:     { key: 'subscriber',     label: 'Subscriber',     color: '#065f46', bg: '#d1fae5' },
  cancelled:      { key: 'cancelled',      label: 'Cancelled',      color: '#9a3412', bg: '#ffedd5' },
  refunded:       { key: 'refunded',       label: 'Refunded',       color: '#5b21b6', bg: '#ede9fe' },
  expired:        { key: 'expired',        label: 'Expired',        color: '#7f1d1d', bg: '#fee2e2' },
};

// Hover-tooltip text for the status terms + actions — single source, mirrors
// docs/admin/csr-glossary.md. Reused as `title` tooltips on badges/buttons so the in-app
// definitions never drift from the glossary. Plan keys match PLAN_STATES (CSR_TERMS[plan.key]).
export const CSR_TERMS = {
  active:     'Account is active — the user can log in normally.',
  suspended:  "Account shut down — the user can't log in (BC “blocked”). About access, not billing. Reversible via Unsuspend.",
  free:       'Signed up, never attempted payment — not a paying customer.',
  payment_failed: 'Tried to pay but no charge ever settled (declined/blocked attempts) — a recoverable checkout, not a paying customer.',
  refunded:   'Money was returned on a settled charge. Display state — access still runs to the period end unless the order was ended.',
  trial:      'Active paid order, still in the trial — paid the trial price, not yet billed a full recurring cycle.',
  subscriber: 'Active recurring subscription — a full cycle has billed.',
  cancelled:  "Subscription set to stop — won't renew, no future charges — but keeps access until the current paid period ends (cancel-at-period-end).",
  expired:    'Subscription has ended — no active paid order remains.',
  suspend:    "Lock the account (user can't log in). Reversible via Unsuspend. Does not stop billing.",
  cancel:     "Stop the subscription's future billing (cancel-at-period-end). Access continues until period end. Reversible via Reactivate.",
  void:       'Kill a charge before it settles — no money moves.',
  refund:     'Return money on a charge that already settled.',
};

function orderCollected(o) { return Number(o?.transient?.amount?.collected ?? 0); }
function orderIsPaid(o) {
  if (orderCollected(o) > 0) return true;
  const cps = Array.isArray(o?.commercePayments) ? o.commercePayments : [];
  return cps.some((p) => p?.type === 'sale' && p?.status === 'fulfilled');
}

// A refund happened when a refund payment settled, or BC marked the order itself
// as a refund (order.type / statusReason carry 'refund' — observed live 2026-06-30
// on order 6a44100827aa861231e1f584: type='refund', statusReason='correct|refund').
export function orderIsRefunded(o) {
  const norm = (s) => (s || '').toLowerCase();
  if (norm(o?.type) === 'refund') return true;
  if (/refund/.test(norm(o?.statusReason))) return true;
  const refunded = Number(o?.transient?.amount?.refunded ?? 0);
  if (refunded > 0) return true;
  const cps = Array.isArray(o?.commercePayments) ? o.commercePayments : [];
  return cps.some((p) => (p?.type || '').toLowerCase() === 'refund' && p?.status === 'fulfilled');
}

export function getPlanState(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const norm = (s) => (s || '').toLowerCase();
  const paid = list.filter(orderIsPaid);
  // Never paid: split "never tried" from "tried and every charge failed/blocked"
  // (owner 2026-07-02) — the latter are recoverable checkouts CSRs should spot.
  if (paid.length === 0) return list.length === 0 ? PLAN_STATES.free : PLAN_STATES.payment_failed;

  const isCanceled = (o) => o?.transient?.canceled || norm(o?.subStatus) === 'canceled' || norm(o?.subStatus) === 'cancelled';
  const isExpired = (o) => norm(o?.subStatus) === 'expired';
  const isActive = (o) => norm(o?.status) === 'active' && !isCanceled(o) && !isExpired(o);

  const active = paid.find(isActive);
  if (active) {
    // S0 (trial) vs S1+ (subscriber) — aligned with billingClassification (verified live 2026-07-22):
    // read BC's schedule.sequence (the NEXT charge) — a trial's next charge is sequence 1, so seq<=1 is
    // still S0; fall back to settled sale-count (the trial books as 1 fulfilled sale). Replaces the frozen
    // `collected < recurring` heuristic that never converted anyone (100% stuck at "Trial").
    const seq = active?.schedule?.data?.sequence;
    const settledCount = (Array.isArray(active?.commercePayments) ? active.commercePayments : [])
      .filter((p) => (p?.type || '').toLowerCase() === 'sale' && (p?.status || '').toLowerCase() === 'fulfilled').length;
    const stillTrial = Number.isFinite(seq) ? seq <= 1 : settledCount <= 1;
    return stillTrial ? PLAN_STATES.trial : PLAN_STATES.subscriber;
  }
  // No active order left — a settled refund beats cancelled/expired for display
  // (it's the fact a CSR needs first; bug list 7/2 #8: refunded user read "Trial").
  if (paid.some(orderIsRefunded)) return PLAN_STATES.refunded;
  if (paid.some(isCanceled)) return PLAN_STATES.cancelled;
  if (paid.some(isExpired)) return PLAN_STATES.expired;
  return PLAN_STATES.expired; // paid before, no active order
}

// BC suspends via status='blocked' (no 'suspended' in its enum). Treat 'suspended' too.
export function isSuspendedStatus(status) {
  const s = (status || '').toLowerCase();
  return s === 'blocked' || s === 'suspended';
}

// ── Lazy plan-state fetch for list views (throttled + cached per session) ──
// The user-list objects don't carry order data, so the list resolves plan state per row
// on demand. Cached by userId; concurrency-capped so a 250-row scan can't flood BC.
const planCache = new Map();
const queue = [];
let active = 0;
const MAX_CONCURRENT = 4;
function pump() {
  while (active < MAX_CONCURRENT && queue.length) {
    const job = queue.shift();
    active += 1;
    job().finally(() => { active -= 1; pump(); });
  }
}
function runQueued(fn) {
  return new Promise((resolve, reject) => {
    queue.push(() => fn().then(resolve, reject));
    pump();
  });
}

// Drop a user's cached plan after any billing mutation (refund/cancel) so list
// views don't keep showing the pre-mutation state for the rest of the session
// (bug list 7/2 #8: directory said Trial after a refund).
export function invalidatePlanState(userId) {
  if (userId) { planCache.delete(userId); ordersCache.delete(userId); }
}

export async function fetchPlanState(userId) {
  if (!userId) return null;
  if (planCache.has(userId)) return planCache.get(userId);
  try {
    const res = await runQueued(() => api.adminListPurchases({ userId }));
    const orders = res?.data ?? res?.orders ?? (Array.isArray(res) ? res : []);
    ordersCache.set(userId, orders);
    const plan = getPlanState(orders);
    planCache.set(userId, plan);
    return plan;
  } catch {
    return null; // unknown — leave blank, don't cache the failure
  }
}

// Raw orders for a user (cached) — lets the Users list compute the single getCustomerStatus (which needs
// the order set + the user's account status). Shares the fetch/cache with fetchPlanState.
const ordersCache = new Map();
export async function fetchUserOrders(userId) {
  if (!userId) return [];
  if (ordersCache.has(userId)) return ordersCache.get(userId);
  try {
    const res = await runQueued(() => api.adminListPurchases({ userId }));
    const orders = res?.data ?? res?.orders ?? (Array.isArray(res) ? res : []);
    ordersCache.set(userId, orders);
    return orders;
  } catch {
    return [];
  }
}
