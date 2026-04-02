import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api from '../../api';
import styles from './PurchaseDetailPage.module.css';

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
    setActing(true);
    setActionMsg('');
    try {
      await api.adminRefundPurchase({
        commercePaymentType: 'refund',
        targetCommerceOrderId: order._id,
        targetCommerceOrderRevisionId: order.currentRevisionId,
        targetCommercePaymentId: salePayment._id,
        targetCommercePaymentRevisionId: salePayment.currentRevisionId,
        amount,
      });
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

  const collected = order?.transient?.amount?.collected;
  const refunded  = order?.transient?.amount?.refunded;
  const canceled  = order?.transient?.canceled;
  const backHref  = userId ? `/admin/users/${userId}` : '/admin/orders';

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
                  {refunded != null && refunded > 0 && (
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
                    {order.schedule?.dueTimestamp && (
                      <tr><td>Next billing</td><td>{fmtDate(order.schedule.dueTimestamp)}</td></tr>
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
                            <td className={styles.td}>{fmtDate(p.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
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
                  <button className={styles.refundBtn} onClick={handleRefund} disabled={acting}>
                    {acting ? '…' : 'Refund'}
                  </button>
                </div>

                <hr className={styles.divider} />

                {!canceled ? (
                  <button
                    className={`${styles.actionBtn} ${styles.cancelBtn}`}
                    onClick={() => handleCancel(true)}
                    disabled={acting}
                  >
                    Cancel Order
                  </button>
                ) : (
                  <button
                    className={`${styles.actionBtn} ${styles.reactivateBtn}`}
                    onClick={() => handleCancel(false)}
                    disabled={acting}
                  >
                    Reactivate Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
};

export default PurchaseDetailPage;
