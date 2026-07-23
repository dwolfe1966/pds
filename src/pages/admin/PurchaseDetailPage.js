import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { getOrderCollected, getOrderRefunded } from '../../utils/orderFinancials';
import BillingLifecyclePanel from './BillingLifecyclePanel';
import { getOrderCard } from '../../utils/orderCard';
import styles from './PurchaseDetailPage.module.css';
import RefundEmailModal from './RefundEmailModal';
import { CSR_TERMS } from './userState';

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return '—'; }
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}

function resolveStatus(order) {
  if (order?.transient?.canceled) return 'canceled';
  // Cancel-at-period-end persists as subStatus=canceled while status stays 'active'.
  // Without this, the badge reads "Active" on reload and the cancel looks like it
  // didn't take (admin shows it correctly) — Hana's report.
  if (order?.subStatus === 'canceled' || order?.subStatus === 'cancelled') return 'canceled';
  return (order?.status || '').toLowerCase() || 'unknown';
}

function StatusBadge({ order }) {
  const s = resolveStatus(order);
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  let cls = styles.badgeDefault;
  if (s === 'active') cls = styles.badgeActive;
  else if (s === 'canceled' || s === 'cancelled') cls = styles.badgeCanceled;
  else if (s === 'failed') cls = styles.badgeFailed;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

function TypeChip({ type }) {
  const t = (type || '').toLowerCase();
  let cls = styles.typeDefault;
  if (t === 'sale') cls = styles.typeSale;
  else if (t === 'refund') cls = styles.typeRefund;
  return <span className={`${styles.typeChip} ${cls}`}>{type || '—'}</span>;
}

function StatusChip({ status }) {
  const s = (status || '').toLowerCase();
  let cls = styles.statusDefault;
  if (s === 'fulfilled') cls = styles.statusFulfilled;
  else if (s === 'failed') cls = styles.statusFailed;
  else if (s === 'pending') cls = styles.statusPending;
  return <span className={`${styles.statusChip} ${cls}`}>{status || '—'}</span>;
}

// ─── Failure decoding ─────────────────────────────────────────────────────────
// Turn BC/processor failure codes into plain English for CSRs. Unknown codes fall
// back to the raw value (still informative), so this never hides data.

// BC velocity / sub-status codes (from commercePayment.subStatus / velocityOptionKeys).
const BC_DECLINE_LABELS = {
  declineTooManySignupAttempts: 'Too many signup attempts in a short window (BC velocity block)',
  declineDupSignup: 'Duplicate signup — same client/session/billing identity reused',
  declineDisputeCcNumber: 'Card number flagged for a prior dispute',
  declineTooManyCards: 'Too many different cards tried',
  declineTooManyAttempts: 'Too many payment attempts',
  FailedTx: 'Transaction failed at the processor',
};

// Common card-processor response codes (ISO-8583 style). Covers the ones we've
// seen + the usual suspects; unknowns show the raw code.
const GATEWAY_CODE_LABELS = {
  '00': 'Approved',
  '01': 'Refer to card issuer',
  '02': 'Refer to card issuer (special condition)',
  '05': 'Do not honor (generic decline)',
  '12': 'Invalid transaction',
  '13': 'Invalid amount',
  '14': 'Invalid card number',
  '41': 'Lost card',
  '43': 'Stolen card',
  '51': 'Insufficient funds',
  '54': 'Expired card',
  '57': 'Transaction not permitted to cardholder',
  '61': 'Exceeds withdrawal amount limit',
  '62': 'Restricted card',
  '65': 'Activity limit exceeded (card velocity — too many transactions)',
  '82': 'Invalid CVV / negative CAM',
  '91': 'Issuer or switch unavailable',
  '96': 'System malfunction',
};

// Extract a structured failure summary from a commercePayment, or null if it did
// not fail. Reads the same paths surfaced in the davidtest-7-2 order dig.
function getPaymentFailure(p) {
  const status = (p.status || '').toLowerCase();
  if (!status || status === 'fulfilled' || status === 'pending') return null;
  const rr = p.requestResult || {};
  const rawResult = p.rawResponse?.Message?.Response?.Result || {};
  const gwCode = rr.primaryCode != null ? String(rr.primaryCode)
    : (rawResult.ResponseCode != null ? String(rawResult.ResponseCode) : null);
  const gwText = (rr.primaryCodeMessage || rawResult.ResponseText || '')
    .replace(new RegExp('^' + (gwCode || '') + '\\s*:\\s*'), '') || null;
  const reason = p.subStatus || p.gatewayTransactionSubStatus || null;
  const meta = p.transactionMeta || {};
  const tok = p.commerceToken || {};
  const binInfo = tok.transient?.bin || {};
  return {
    status,
    gwCode,
    gwText,
    gwCodeLabel: gwCode ? GATEWAY_CODE_LABELS[gwCode] : null,
    reason,
    reasonLabel: reason ? BC_DECLINE_LABELS[reason] : null,
    velocity: p.velocityOptionKeys || [],
    subType: p.subType || null,
    cascade: !!meta.cascade || p.data?.tracking?.partner?.channel === 'cascade-decliner',
    retryCount: meta.immediateRetryCount != null ? meta.immediateRetryCount : p.immediateRetryCount,
    nonMemberOnly: meta.nonMemberOnly,
    when: p.paymentTimestamp || p.createdAt,
    card: tok.lastDigits ? {
      last4: tok.lastDigits,
      brand: binInfo.brand || tok.type || null,
      type: binInfo.type || null,
      level: binInfo.level || null,
      country: binInfo.country || null,
      bank: binInfo.bank || null,
    } : null,
  };
}

// One-line human summary for the payment-history "Reason" column.
function shortFailureReason(p) {
  const f = getPaymentFailure(p);
  if (!f) return null;
  if (f.reason) return f.reasonLabel || f.reason;
  if (f.gwText) return f.gwCode ? `${f.gwCode}: ${f.gwText}` : f.gwText;
  return f.status;
}

// ─── PurchaseDetailPage ───────────────────────────────────────────────────────

const PurchaseDetailPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [acting, setActing] = useState(false);
  const [actionMsg, setActionMsg] = useState('');
  const [actionSuccess, setActionSuccess] = useState(false);
  const [showRefundEmail, setShowRefundEmail] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      try {
        const data = await api.adminGetPurchase(id, userId);
        setOrder(data);
      } catch (err) {
        setError(err.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchOrder();
  }, [id, userId]);

  const handleRefund = async () => {
    if (!order) return;
    const salePayment = (order.commercePayments || []).find(
      (p) => p.type === 'sale' && p.status === 'fulfilled'
    );
    if (!salePayment) {
      setActionSuccess(false);
      setActionMsg('No fulfilled sale payment found on this order.');
      return;
    }
    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0) {
      setActionSuccess(false);
      setActionMsg('Enter a valid refund amount.');
      return;
    }
    // Real-money action — require an explicit confirmation before firing.
    if (typeof window !== 'undefined' && typeof window.confirm === 'function'
        && !window.confirm(`Refund $${amount.toFixed(2)} to this customer? This cannot be undone.`)) {
      return;
    }
    setActing(true);
    setActionMsg('');
    try {
      // Refresh order before submitting so revision IDs match BC's current state.
      let orderRevisionId = order.currentRevisionId;
      let paymentRevisionId = salePayment.currentRevisionId;
      const orderUserId = order.payerId || userId;
      if (orderUserId) {
        try {
          const fresh = await api.adminGetOrderDetail(orderUserId, order._id);
          if (fresh?.currentRevisionId) orderRevisionId = fresh.currentRevisionId;
          const freshPayment = (fresh?.commercePayments || []).find((p) => p._id === salePayment._id);
          if (freshPayment?.currentRevisionId) paymentRevisionId = freshPayment.currentRevisionId;
        } catch {}
      }

      await api.adminRefundPurchase({
        commercePaymentType: 'refund',
        targetCommerceOrderId: order._id,
        targetCommerceOrderRevisionId: orderRevisionId,
        targetCommercePaymentId: salePayment._id,
        targetCommercePaymentRevisionId: paymentRevisionId,
        amount,
      });
      // Audit note on the user account so the Audit tab reflects this action.
      if (orderUserId) {
        try {
          await api.adminCreateNote({
            userId: orderUserId,
            message: `CSR REFUND: $${Number(amount).toFixed(2)} on order ${(order._id || '').slice(-8)} payment ${(salePayment._id || '').slice(-8)}`,
            contentType: 'text/plain',
          });
        } catch {}
      }
      setActionSuccess(true);
      setActionMsg('Refund initiated successfully.');
      setRefundAmount('');
    } catch (err) {
      setActionSuccess(false);
      setActionMsg(err.message || 'Refund failed.');
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async (flag) => {
    if (!order) return;
    setActing(true);
    setActionMsg('');
    try {
      await api.adminCancelOrder(order._id, flag);
      // Audit note so the Audit tab on the user reflects this cancel/reactivate.
      const orderUserId = order.payerId || userId;
      if (orderUserId) {
        try {
          await api.adminCreateNote({
            userId: orderUserId,
            message: `CSR ${flag ? 'CANCEL' : 'REACTIVATE'}: Order ${(order._id || '').slice(-8)}`,
            contentType: 'text/plain',
          });
        } catch {}
      }
      setActionSuccess(true);
      setActionMsg(flag ? 'Order canceled.' : 'Order reactivated.');
      setOrder((o) => o ? { ...o, transient: { ...o.transient, canceled: flag } } : o);
    } catch (err) {
      setActionSuccess(false);
      setActionMsg(err.message || 'Action failed.');
    } finally {
      setActing(false);
    }
  };

  // Compute from commercePayments rather than trusting BC's pre-summed
  // transient.amount.collected — that field includes rejected attempts.
  // See src/utils/orderFinancials.js for the full reasoning.
  const collected = order ? getOrderCollected(order) : null;
  const refunded  = order ? getOrderRefunded(order) : 0;
  // Cancel-at-period-end orders are status=active + subStatus=canceled. Key off
  // subStatus too — otherwise the action button stays "Cancel Order" and a CSR
  // can't reactivate a cancelled-but-in-period order from this page.
  const canceled  = order?.transient?.canceled || order?.subStatus === 'canceled';
  const backHref  = userId ? `/users/${userId}` : '/orders';
  // Decoded failure summaries for every non-fulfilled payment attempt on the order.
  const failures  = order ? (order.commercePayments || []).map(getPaymentFailure).filter(Boolean) : [];
  // Card / payment method on the order (shown regardless of success or failure).
  const card      = order ? getOrderCard(order) : null;

  return (
    <main className={styles.page}>
      {/* Back */}
      <Link to={backHref} className={styles.backLink}>
        ← {userId ? 'Back to customer' : 'Back to orders'}
      </Link>

      {loading && <div className={styles.loadingMsg}>Loading order…</div>}
      {error   && <div className={styles.errorBanner}>{error}</div>}

      {order && (
        <>
          {/* Page header */}
          <div className={styles.pageHeader}>
            <div className={styles.titleBlock}>
              <h1 className={styles.title}>Order Detail</h1>
              <div className={styles.orderId}>{order._id || order.id}</div>
            </div>
            <div className={styles.headerBadge}>
              <StatusBadge order={order} />
            </div>
          </div>

          {/* Full M-code lifecycle: access/state/risk/event/next + what-to-expect + billing history. */}
          <BillingLifecyclePanel order={order} />

          <div className={styles.layout}>
            {/* ── Left column ── */}
            <div>
              {/* Financial summary */}
              <div className={styles.card}>
                <p className={styles.cardTitle}>Financials</p>
                <div className={styles.amountRow}>
                  <div className={styles.amountItem}>
                    <div className={styles.amountValue}>
                      {collected != null ? `$${Number(collected).toFixed(2)}` : '—'}
                    </div>
                    <div className={styles.amountLabel}>Collected</div>
                  </div>
                  {refunded > 0 && (
                    <div className={styles.amountItem}>
                      <div className={`${styles.amountValue} ${styles.refunded}`}>
                        −${Number(refunded).toFixed(2)}
                      </div>
                      <div className={styles.amountLabel}>Refunded</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Order info */}
              <div className={styles.card}>
                <p className={styles.cardTitle}>Order Info</p>
                <table className={styles.detailTable}>
                  <tbody>
                    <tr><td>Order ID</td><td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{order._id || order.id || '—'}</td></tr>
                    <tr><td>Status</td><td><StatusBadge order={order} /></td></tr>
                    {order.subStatus && <tr><td>Sub-status</td><td>{order.subStatus}</td></tr>}
                    <tr><td>Type</td><td>{order.type || order.commercePayments?.[0]?.type || '—'}</td></tr>
                    <tr><td>Created</td><td>{fmt(order.createdAt)}</td></tr>
                    {(order.schedule?.dueTimestamp || order.dueTimestamp) && (
                      <tr><td>Next billing</td><td>{fmtDate(order.schedule?.dueTimestamp || order.dueTimestamp)}</td></tr>
                    )}
                    {order.statusReason && <tr><td>Status reason</td><td>{BC_DECLINE_LABELS[order.statusReason] || order.statusReason}</td></tr>}
                    {order.brandId && <tr><td>Brand</td><td>{order.brandId}</td></tr>}
                    {(order.shConId || order.shColId) && (
                      <tr><td>Attribution (shN / shL)</td><td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{order.shConId || '—'} / {order.shColId || '—'}</td></tr>
                    )}
                    {order.commerceOffers?.[0] && (
                      <tr><td>Offer</td><td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{order.commerceOffers[0]}</td></tr>
                    )}
                    {order.payerId && <tr><td>Payer ID</td><td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{order.payerId}</td></tr>}
                    {order.payeeId && <tr><td>Payee ID</td><td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{order.payeeId}</td></tr>}
                    {order.ipAddress && <tr><td>Order IP</td><td>{order.ipAddress}</td></tr>}
                    {order.immediateRetryCount != null && (
                      <tr><td>Retries</td><td>{order.immediateRetryCount}</td></tr>
                    )}
                    {order.currentRevisionId && (
                      <tr><td>Revision ID</td><td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{order.currentRevisionId}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payment method — card attributes, shown for success OR failure. */}
              {card && (
                <div className={styles.card}>
                  <p className={styles.cardTitle}>Payment Method</p>
                  <table className={styles.detailTable}>
                    <tbody>
                      <tr><td>Card</td><td><strong>{card.brand || 'Card'} •••• {card.last4}</strong></td></tr>
                      {card.expiry && <tr><td>Expires</td><td>{card.expiry}</td></tr>}
                      {(card.type || card.level) && <tr><td>Card type</td><td>{[card.type, card.level].filter(Boolean).join(' · ')}</td></tr>}
                      {card.bank && <tr><td>Issuing bank</td><td>{card.bank}</td></tr>}
                      {card.country && <tr><td>Country</td><td>{card.country}</td></tr>}
                      {card.bin && <tr><td>BIN</td><td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{card.bin}</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Payment history */}
              {(order.commercePayments || []).length > 0 && (
                <div className={styles.card}>
                  <p className={styles.cardTitle}>Payment History</p>
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>Type</th>
                          <th className={styles.th}>Status</th>
                          <th className={styles.th}>Amount</th>
                          <th className={styles.th}>Reason</th>
                          <th className={styles.th}>Date</th>
                          <th className={styles.th}>Gateway Txn</th>
                          <th className={styles.th}>Device</th>
                          <th className={styles.th}>IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.commercePayments.map((p) => {
                          const reason = shortFailureReason(p);
                          return (
                          <tr key={p._id} className={styles.tr}>
                            <td className={styles.td}><TypeChip type={p.type} /></td>
                            <td className={styles.td}><StatusChip status={p.status} /></td>
                            <td className={styles.td}>
                              {p.totalPrice?.amount != null
                                ? `$${Number(p.totalPrice.amount).toFixed(2)}`
                                : '—'}
                            </td>
                            <td className={styles.td} style={{ fontSize: '0.78rem', color: reason ? '#b91c1c' : '#9ca3af', maxWidth: 220 }}>{reason || '—'}</td>
                            <td className={styles.td}>{fmtDate(p.paymentTimestamp || p.createdAt)}</td>
                            <td className={styles.td} style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{p.gatewayTransactionId || '—'}</td>
                            <td className={styles.td}>{p.device || '—'}</td>
                            <td className={styles.td} style={{ fontSize: '0.78rem' }}>{p.ipAddress || '—'}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Why payments failed — decodes every non-fulfilled attempt into
                  plain English for CSRs (processor code, BC decline/velocity, cascade
                  retry context, card). Only renders when there's a failure. */}
              {failures.length > 0 && (
                <div className={styles.card}>
                  <p className={styles.cardTitle}>Why payments failed</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {failures.map((f, i) => (
                      <div key={i} style={{ border: '1px solid #fecaca', background: '#fef2f2', borderRadius: '0.5rem', padding: '0.75rem 0.9rem', fontSize: '0.85rem', color: '#374151' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.4rem' }}>
                          <strong style={{ color: '#b91c1c', textTransform: 'capitalize' }}>Attempt {i + 1}: {f.status}</strong>
                          <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>{fmt(f.when)}</span>
                        </div>
                        {(f.gwCode || f.gwText) && (
                          <div style={{ marginBottom: '0.25rem' }}>
                            <span style={{ color: '#6b7280' }}>Processor: </span>
                            {f.gwCode && <strong>{f.gwCode}</strong>} {f.gwText}
                            {f.gwCodeLabel && <span style={{ color: '#6b7280' }}> — {f.gwCodeLabel}</span>}
                          </div>
                        )}
                        {f.reason && (
                          <div style={{ marginBottom: '0.25rem' }}>
                            <span style={{ color: '#6b7280' }}>Decline reason: </span>
                            <strong>{f.reasonLabel || f.reason}</strong>
                            {f.reasonLabel && <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}> ({f.reason})</span>}
                          </div>
                        )}
                        {f.velocity.length > 0 && (
                          <div style={{ marginBottom: '0.25rem' }}>
                            <span style={{ color: '#6b7280' }}>Velocity flags triggered: </span>{f.velocity.join(' · ')}
                          </div>
                        )}
                        {(f.subType || f.cascade || f.retryCount != null || f.nonMemberOnly) && (
                          <div style={{ marginBottom: '0.25rem', color: '#6b7280', fontSize: '0.8rem' }}>
                            {f.cascade ? 'BC cascade-decliner auto-retry' : 'Attempt'}
                            {f.subType && ` · ${f.subType}`}
                            {f.retryCount != null && ` · ${f.retryCount} auto-retries`}
                            {f.nonMemberOnly && ' · non-member-only offer'}
                          </div>
                        )}
                        {f.card && (
                          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                            Card: {f.card.brand || 'card'} ••{f.card.last4}
                            {f.card.type && ` · ${f.card.type}`}{f.card.level ? ` ${f.card.level}` : ''}
                            {f.card.bank && ` · ${f.card.bank}`}{f.card.country ? ` (${f.card.country})` : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.5 }}>
                    BC velocity blocks (e.g. too many signup attempts / duplicate signup) are fraud gates that usually clear after a cooldown — but a corrected-card retry can still be blocked if the same client identity is reused. Full processor request/response is in the raw fields below.
                  </p>
                </div>
              )}

              {/* All order fields (raw) — nothing hidden. Includes per-payment
                  rawRequest/rawResponse (card BIN/type, AVS/CVV, decline reason),
                  schedule, transient, transactionMeta, etc. */}
              <div className={styles.card}>
                <details>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#374151' }}>
                    All order fields (raw)
                  </summary>
                  <pre style={{
                    marginTop: '0.75rem', maxHeight: 360, overflow: 'auto',
                    background: '#0b1021', color: '#d6e2ff', padding: '0.75rem',
                    borderRadius: '0.5rem', fontSize: '0.72rem', lineHeight: 1.45,
                  }}>{JSON.stringify(order, null, 2)}</pre>
                </details>
              </div>
            </div>

            {/* ── Right column — actions ── */}
            <div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Actions</p>

                {actionMsg && (
                  <div className={`${styles.actionMsg} ${actionSuccess ? styles.actionMsgSuccess : styles.actionMsgError}`}>
                    {actionMsg}
                  </div>
                )}

                <p style={{ fontSize: '0.82rem', color: '#666', margin: '0 0 6px' }}>Refund amount ($)</p>
                <div className={styles.refundForm}>
                  <input
                    className={styles.refundInput}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <button title={CSR_TERMS.refund} className={styles.refundBtn} onClick={handleRefund} disabled={acting}>
                    {acting ? '…' : 'Refund'}
                  </button>
                </div>

                <hr className={styles.divider} />

                {!canceled ? (
                  <button
                    title={CSR_TERMS.cancel}
                    className={`${styles.actionBtn} ${styles.cancelBtn}`}
                    onClick={() => handleCancel(true)}
                    disabled={acting}
                  >
                    Cancel Order
                  </button>
                ) : (
                  <button
                    title={CSR_TERMS.cancel}
                    className={`${styles.actionBtn} ${styles.reactivateBtn}`}
                    onClick={() => handleCancel(false)}
                    disabled={acting}
                  >
                    Reactivate Order
                  </button>
                )}

                <hr className={styles.divider} />

                <button
                  className={`${styles.actionBtn}`}
                  style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0' }}
                  onClick={() => setShowRefundEmail(true)}
                >
                  Request Billing Action
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Refund Email Modal */}
      {showRefundEmail && (
        <RefundEmailModal
          userId={userId}
          userEmail=""
          orderId={order?._id || order?.id || ''}
          amount={collected != null ? Number(collected) : undefined}
          onClose={() => setShowRefundEmail(false)}
        />
      )}
    </main>
  );
};

export default PurchaseDetailPage;
