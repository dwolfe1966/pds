import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import csrApi from '../../services/csrApiService';

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder]       = useState(null);
  const [payments, setPayments] = useState([]);
  const [histories, setHistories] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [msg, setMsg]           = useState('');
  const [tab, setTab]           = useState('payments');
  const [refundModal, setRefundModal] = useState(null); // { payment }
  const [refundAmount, setRefundAmount] = useState('');
  const [refundType, setRefundType]     = useState('refund');
  const [newDue, setNewDue] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [oRes, pRes, hRes] = await Promise.all([
          csrApi.getUserOrder({ userId: null, orderId: id }),
          csrApi.findOrderPayments({ orderId: id }),
          csrApi.findOrderHistories({ orderId: id }),
        ]);
        setOrder(oRes.order);
        setPayments(pRes.payments || oRes.commercePayments || []);
        setHistories(hRes.histories || []);
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const handleRefund = async () => {
    if (!refundModal) return;
    try {
      await csrApi.refundVoidOrder({
        commercePaymentType: refundType,
        targetCommerceOrderId: id,
        targetCommerceOrderRevisionId: order?.currentRevisionId || '',
        targetCommercePaymentId: refundModal.payment._id,
        targetCommercePaymentRevisionId: refundModal.payment.currentRevisionId || '',
        amount: parseFloat(refundAmount),
      });
      setMsg(`${refundType === 'refund' ? 'Refund' : 'Void'} processed successfully.`);
      setRefundModal(null);
    } catch (err) { setError(err.message); }
  };

  const handleUpdateSchedule = async () => {
    if (!order?.schedule?._id || !newDue) return;
    try {
      await csrApi.updateScheduleDueTimestamp({ scheduleId: order.schedule._id, dueTimestamp: new Date(newDue).getTime() });
      setMsg('Next billing date updated.');
      setNewDue('');
    } catch (err) { setError(err.message); }
  };

  const handleCancelToggle = async () => {
    const cancel = order.status !== 'cancelled';
    if (!window.confirm(cancel ? 'Cancel this order?' : 'Reactivate this order?')) return;
    try {
      await csrApi.cancelUncancelOrder({ orderId: id, flag: cancel });
      setOrder(prev => ({ ...prev, status: cancel ? 'cancelled' : 'active' }));
      setMsg(cancel ? 'Order cancelled.' : 'Order reactivated.');
    } catch (err) { setError(err.message); }
  };

  if (loading) return <p style={{ color: '#718096' }}>Loading…</p>;
  if (!order)  return <p className="error-msg">Order not found.</p>;

  return (
    <>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: '1rem' }} onClick={() => navigate(-1)}>← Back</button>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="two-col">
          <div className="col">
            <h2 style={{ margin: '0 0 0.5rem' }}>Order</h2>
            <p className="mini-text">ID: <code style={{ fontSize: '0.75rem' }}>{order._id}</code></p>
            <p className="mini-text">Status: <span className={`badge badge-${order.status === 'active' ? 'success' : order.status === 'failed' ? 'danger' : 'neutral'}`}>{order.status}</span></p>
            <p className="mini-text">Amount: ${(order.amount || 0).toFixed(2)}</p>
            <p className="mini-text">Created: {order.createdAt ? new Date(order.createdAt).toLocaleString() : '—'}</p>
          </div>
          <div className="col">
            {order.schedule && (
              <>
                <p className="mini-text">Next billing: {new Date(order.schedule.dueTimestamp).toLocaleDateString()}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)} />
                  <button className="btn btn-secondary btn-sm" onClick={handleUpdateSchedule}>Update Date</button>
                </div>
              </>
            )}
            <div className="btn-row">
              {order.status !== 'cancelled'
                ? <button className="btn btn-danger btn-sm" onClick={handleCancelToggle}>Cancel Order</button>
                : <button className="btn btn-secondary btn-sm" onClick={handleCancelToggle}>Reactivate Order</button>
              }
              {order.payerId && (
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/customers/${order.payerId}`)}>View Customer</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg">{msg}</div>}

      <div className="tabs">
        {['payments', 'history'].map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'payments' && (
        <table className="data-table">
          <thead><tr><th>Payment ID</th><th>Amount</th><th>Status</th><th>Type</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {payments.map(p => (
              <tr key={p._id}>
                <td><code style={{ fontSize: '0.75rem' }}>{p._id}</code></td>
                <td>${(p.amount || 0).toFixed(2)}</td>
                <td><span className={`badge badge-${p.status === 'fulfilled' ? 'success' : 'danger'}`}>{p.status}</span></td>
                <td>{p.type}</td>
                <td>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}</td>
                <td>
                  {p.status === 'fulfilled' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => { setRefundModal({ payment: p }); setRefundAmount(p.amount?.toString() || ''); }}>
                      Refund/Void
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={6} className="empty-state">No payments.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'history' && (
        <table className="data-table">
          <thead><tr><th>Revision ID</th><th>Created</th></tr></thead>
          <tbody>
            {histories.map(h => (
              <tr key={h._id}>
                <td><code style={{ fontSize: '0.75rem' }}>{h._id}</code></td>
                <td>{h.createdAt ? new Date(h.createdAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {histories.length === 0 && <tr><td colSpan={2} className="empty-state">No history entries.</td></tr>}
          </tbody>
        </table>
      )}

      {/* Refund modal */}
      {refundModal && (
        <div className="modal-overlay" onClick={() => setRefundModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2>Refund / Void Payment</h2>
            <div className="form-group">
              <label>Type</label>
              <select value={refundType} onChange={e => setRefundType(e.target.value)}>
                <option value="refund">Refund (partial)</option>
                <option value="void">Void (full)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Amount</label>
              <input type="number" step="0.01" min="0.01" max={refundModal.payment.amount} value={refundAmount} onChange={e => setRefundAmount(e.target.value)} />
            </div>
            <div className="btn-row">
              <button className="btn btn-danger" onClick={handleRefund}>Confirm</button>
              <button className="btn btn-secondary" onClick={() => setRefundModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
