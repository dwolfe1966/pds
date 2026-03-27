import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../../api';

/**
 * Admin page showing details for a single order via BC CSR API.
 *
 * BC refund requires: commercePaymentType, targetCommerceOrderId,
 * targetCommerceOrderRevisionId, targetCommercePaymentId,
 * targetCommercePaymentRevisionId, amount
 *
 * URL: /admin/purchases/:id?userId=<userId>
 */
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
    // Find the most recent sale payment to refund against
    const salePayment = (order.commercePayments || []).find((p) => p.type === 'sale' && p.status === 'fulfilled');
    if (!salePayment) {
      setActionMsg('Error: No fulfilled sale payment found on this order.');
      return;
    }
    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0) {
      setActionMsg('Error: Enter a valid refund amount.');
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
      setActionMsg('Refund initiated successfully.');
    } catch (err) {
      setActionMsg(`Error: ${err.message}`);
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
      setActionMsg(flag ? 'Order canceled.' : 'Order reactivated.');
      setOrder((o) => o ? { ...o, transient: { ...o.transient, canceled: flag } } : o);
    } catch (err) {
      setActionMsg(`Error: ${err.message}`);
    } finally {
      setActing(false);
    }
  };

  const collected = order?.transient?.amount?.collected;
  const refunded = order?.transient?.amount?.refunded;
  const canceled = order?.transient?.canceled;

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Order Detail</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {order && (
        <div>
          <p><strong>Order ID:</strong> {order._id || order.id}</p>
          <p><strong>Status:</strong> {order.status}</p>
          {order.subStatus && <p><strong>Sub-status:</strong> {order.subStatus}</p>}
          <p><strong>Created:</strong> {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</p>
          {collected != null && <p><strong>Collected:</strong> ${collected.toFixed(2)}</p>}
          {refunded != null && refunded > 0 && <p><strong>Refunded:</strong> ${refunded.toFixed(2)}</p>}
          {canceled && <p style={{ color: '#dc2626' }}><strong>Canceled</strong></p>}

          {order.schedule && (
            <p><strong>Next billing:</strong> {new Date(order.schedule.dueTimestamp).toLocaleDateString()}</p>
          )}

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Refund amount ($)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  style={{ width: '100px', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  placeholder="0.00"
                />
                <button
                  onClick={handleRefund}
                  disabled={acting}
                  style={{ padding: '0.4rem 0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {acting ? '…' : 'Refund'}
                </button>
              </div>
            </div>

            {!canceled ? (
              <button
                onClick={() => handleCancel(true)}
                disabled={acting}
                style={{ marginTop: '1.25rem', padding: '0.4rem 0.75rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel Order
              </button>
            ) : (
              <button
                onClick={() => handleCancel(false)}
                disabled={acting}
                style={{ marginTop: '1.25rem', padding: '0.4rem 0.75rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Reactivate Order
              </button>
            )}
          </div>

          {actionMsg && (
            <p style={{ marginTop: '0.75rem', color: actionMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{actionMsg}</p>
          )}

          {(order.commercePayments || []).length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3>Payment History</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Type</th>
                    <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Status</th>
                    <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Amount</th>
                    <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {order.commercePayments.map((p) => (
                    <tr key={p._id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem' }}>{p.type}</td>
                      <td style={{ padding: '0.5rem' }}>{p.status}</td>
                      <td style={{ padding: '0.5rem' }}>${p.totalPrice?.amount?.toFixed(2) ?? '—'}</td>
                      <td style={{ padding: '0.5rem' }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default PurchaseDetailPage;
