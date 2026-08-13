/**
 * Admin-side helpers for computing accurate order financials.
 *
 * BC's `order.transient.amount.collected` cannot be trusted as a true
 * "money received" number — it sums payment *attempts* (including rejected
 * ones), not actual collected dollars. Observed 2026-05-31 on order
 * 6a1bb9d068c31e075cae9b12 (test1@gmail.com): one fulfilled $49.98 sale
 * plus several rejected attempts, but `transient.amount.collected` reported
 * $100.96 to the CSR tool.
 *
 * Authoritative source: `order.commercePayments[]`, where each entry has a
 * concrete `status` (fulfilled / rejected / ...) and `type` (sale / refund).
 * Fulfilled sales are the only payments that put money in our account.
 */

/**
 * Sum of fulfilled `sale` payments on this order, in dollars.
 * Returns 0 when there are no payments (BC sometimes omits the array on
 * partially-provisioned orders); returns BC's pre-summed field as a last
 * resort only when there is NO commercePayments array at all — that lets
 * historical orders without payment-array population still display something
 * rather than $0.
 */
export function getOrderCollected(order) {
  const payments = Array.isArray(order?.commercePayments) ? order.commercePayments : null;
  if (payments != null) {
    return payments
      .filter((p) => p?.type === 'sale' && p?.status === 'fulfilled')
      .reduce((sum, p) => sum + Number(p?.totalPrice?.amount ?? 0), 0);
  }
  const fallback = order?.transient?.amount?.collected;
  return fallback != null ? Number(fallback) : 0;
}

/**
 * Sum of fulfilled `refund` payments on this order, in dollars.
 * Same trust model as `getOrderCollected` — prefer the per-payment truth,
 * fall back to `transient.amount.refunded` only when the array is absent.
 */
export function getOrderRefunded(order) {
  const payments = Array.isArray(order?.commercePayments) ? order.commercePayments : null;
  if (payments != null) {
    return payments
      .filter((p) => p?.type === 'refund' && p?.status === 'fulfilled')
      .reduce((sum, p) => sum + Number(p?.totalPrice?.amount ?? 0), 0);
  }
  const fallback = order?.transient?.amount?.refunded;
  return fallback != null ? Number(fallback) : 0;
}

/**
 * Per-payment refundable balance for each fulfilled `sale` on this order.
 *
 * BC's `commerceBilling/correct` refunds against ONE specific payment and rejects
 * with `nonCorrectable` if the requested amount exceeds that payment's remaining
 * correctable balance (collected − already-refunded ON THAT payment). An order with
 * a rebill/renewal has multiple sale payments, and a prior partial refund exhausts
 * only one of them — so blindly targeting the first sale (or over-asking) trips
 * `nonCorrectable` even when the order as a whole still has money to refund.
 *
 * Returns one row per fulfilled sale: `{ payment, collected, refunded, refundable }`
 * (dollars). Refunds are linked to their parent sale via `parentId` (BC's linkage);
 * unlinked refunds are attributed to the sole sale when there is exactly one, else
 * left unattributed (conservative — never inflates a payment's refundable).
 */
export function getRefundableSalePayments(order) {
  const payments = Array.isArray(order?.commercePayments) ? order.commercePayments : [];
  const amt = (p) => Number(p?.totalPrice?.amount ?? 0);
  const sales = payments.filter((p) => p?.type === 'sale' && p?.status === 'fulfilled');
  const refunds = payments.filter((p) => p?.type === 'refund' && p?.status === 'fulfilled');
  const refundedByParent = {};
  let unlinkedRefund = 0;
  for (const r of refunds) {
    const pid = r?.parentId || r?.parentPaymentId || r?.targetCommercePaymentId;
    if (pid) refundedByParent[pid] = (refundedByParent[pid] || 0) + amt(r);
    else unlinkedRefund += amt(r);
  }
  return sales.map((s) => {
    let refunded = refundedByParent[s._id] || 0;
    if (unlinkedRefund && sales.length === 1) refunded += unlinkedRefund; // single sale → all refunds are its
    const refundable = Math.max(0, amt(s) - refunded);
    return { payment: s, collected: amt(s), refunded, refundable };
  });
}

/**
 * Normalize a commercePayment's timestamp to a comparable epoch (ms).
 *
 * BC's `paymentTimestamp` is a numeric Unix-ms; `createdAt` is an ISO string.
 * Coercing both to a number lets `.sort` compare with subtraction and never
 * trip over `(123).localeCompare(...)` — calling a String method on a Number
 * threw a TypeError that white-screened UserDetailPage for any user whose
 * commercePayments had `paymentTimestamp` set (fixed 2026-05-31).
 */
export function paymentEpoch(p) {
  const v = p?.paymentTimestamp ?? p?.createdAt;
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Device + IP from the most recent payment across a user's orders.
 *
 * Sorts each order's `commercePayments` newest-first via `paymentEpoch` and
 * returns the first entry carrying a `device` or `ipAddress`. Returns
 * `{ device: null, ip: null }` when there are no orders/payments or none carry
 * device/IP. Pure — safe to call during render.
 */
export function getLatestPaymentDeviceInfo(orders) {
  if (!Array.isArray(orders) || orders.length === 0) return { device: null, ip: null };
  for (const order of orders) {
    const cpArray = Array.isArray(order?.commercePayments) ? order.commercePayments : [];
    if (cpArray.length > 0) {
      const sorted = [...cpArray].sort((a, b) => paymentEpoch(b) - paymentEpoch(a));
      for (const p of sorted) {
        if (p.device || p.ipAddress) {
          return { device: p.device || null, ip: p.ipAddress || null };
        }
      }
    }
  }
  return { device: null, ip: null };
}

/**
 * Billing ZIP from the most recent billing address across a user's orders.
 *
 * ZIP is NOT a field on the BC user object — neither `/database/search` nor
 * `getUserDetail` project it (verified live 2026-06-04: `'zip' in user` is
 * false on both). It lives on the order billing address, at
 * `commercePayments[].commerceToken.billingAddress.zip` and
 * `commerceTokens[].billingAddress.zip`. Returns the ZIP from the newest
 * payment that carries one, else the first order token's ZIP, else null.
 * Pure — safe to call during render.
 */
export function getLatestBillingZip(orders) {
  return getLatestBillingField(orders, 'zip');
}

// The billing STATE (often empty/bogus in BC — the ZIP is the reliable signal), same lookup path as the zip.
export function getLatestBillingState(orders) {
  return getLatestBillingField(orders, 'state');
}

function getLatestBillingField(orders, field) {
  if (!Array.isArray(orders) || orders.length === 0) return null;
  for (const order of orders) {
    const cpArray = Array.isArray(order?.commercePayments) ? order.commercePayments : [];
    const sorted = [...cpArray].sort((a, b) => paymentEpoch(b) - paymentEpoch(a));
    for (const p of sorted) {
      const v = p?.commerceToken?.billingAddress?.[field];
      if (v) return String(v);
    }
    const tokens = Array.isArray(order?.commerceTokens) ? order.commerceTokens : [];
    for (const t of tokens) {
      const v = t?.billingAddress?.[field];
      if (v) return String(v);
    }
    const v = order?.billingAddress?.[field];
    if (v) return String(v);
  }
  return null;
}
