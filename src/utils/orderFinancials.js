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
