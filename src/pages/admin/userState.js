// Shared CSR user-state derivation: plan state + account status, from BC orders.
// Single source of truth so UserDetailPage and the UsersPage list agree.
import api from '../../api';

// Plan state derived from a user's ORDERS (the authority — roles don't carry paid state):
//   Free       — no order with collected money (just a signup)
//   Trial      — active paid order, still in the trial (collected < one full recurring cycle)
//   Subscriber — active recurring subscription (a full cycle has billed)
//   Cancelled  — set to cancel at period end (subStatus=canceled / transient.canceled)
//   Expired    — subscription ended (subStatus=expired) or no active paid order remains
export const PLAN_STATES = {
  free:       { key: 'free',       label: 'Free',       color: '#374151', bg: '#e5e7eb' },
  trial:      { key: 'trial',      label: 'Trial',      color: '#92400e', bg: '#fef3c7' },
  subscriber: { key: 'subscriber', label: 'Subscriber', color: '#065f46', bg: '#d1fae5' },
  cancelled:  { key: 'cancelled',  label: 'Cancelled',  color: '#9a3412', bg: '#ffedd5' },
  expired:    { key: 'expired',    label: 'Expired',    color: '#7f1d1d', bg: '#fee2e2' },
};

function orderCollected(o) { return Number(o?.transient?.amount?.collected ?? 0); }
function orderIsPaid(o) {
  if (orderCollected(o) > 0) return true;
  const cps = Array.isArray(o?.commercePayments) ? o.commercePayments : [];
  return cps.some((p) => p?.type === 'sale' && p?.status === 'fulfilled');
}

export function getPlanState(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const norm = (s) => (s || '').toLowerCase();
  const paid = list.filter(orderIsPaid);
  if (paid.length === 0) return PLAN_STATES.free;

  const isCanceled = (o) => o?.transient?.canceled || norm(o?.subStatus) === 'canceled' || norm(o?.subStatus) === 'cancelled';
  const isExpired = (o) => norm(o?.subStatus) === 'expired';
  const isActive = (o) => norm(o?.status) === 'active' && !isCanceled(o) && !isExpired(o);

  const active = paid.find(isActive);
  if (active) {
    const collected = orderCollected(active);
    const recurring = Number(active?.schedule?.data?.totalPrice?.amount ?? 0);
    // Still in trial until a full recurring cycle has been billed.
    const stillTrial = recurring > 0 ? collected < recurring : collected < 10;
    return stillTrial ? PLAN_STATES.trial : PLAN_STATES.subscriber;
  }
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

export async function fetchPlanState(userId) {
  if (!userId) return null;
  if (planCache.has(userId)) return planCache.get(userId);
  try {
    const res = await runQueued(() => api.adminListPurchases({ userId }));
    const orders = res?.data ?? res?.orders ?? (Array.isArray(res) ? res : []);
    const plan = getPlanState(orders);
    planCache.set(userId, plan);
    return plan;
  } catch {
    return null; // unknown — leave blank, don't cache the failure
  }
}
