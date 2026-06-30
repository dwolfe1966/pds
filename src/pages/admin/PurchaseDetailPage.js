import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { getOrderCollected, getOrderRefunded } from '../../utils/orderFinancials';
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
                    {order.statusReason && <tr><td>Status reason</td><td>{order.statusReason}</td></tr>}
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
                          <th className={styles.th}>Date</th>
                          <th className={styles.th}>Gateway Txn</th>
                          <th className={styles.th}>Device</th>
                          <th className={styles.th}>IP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.commercePayments.map((p) => (
                          <tr key={p._id} className={styles.tr}>
                            <td className={styles.td}><TypeChip type={p.type} /></td>
                            <td className={styles.td}><StatusChip status={p.status} /></td>
                            <td className={styles.td}>
                              {p.totalPrice?.amount != null
                                ? `$${Number(p.totalPrice.amount).toFixed(2)}`
                                : '—'}
                            </td>
                            <td className={styles.td}>{fmtDate(p.paymentTimestamp || p.createdAt)}</td>
                            <td className={styles.td} style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{p.gatewayTransactionId || '—'}</td>
                            <td className={styles.td}>{p.device || '—'}</td>
                            <td className={styles.td} style={{ fontSize: '0.78rem' }}>{p.ipAddress || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
