import React, { useState, useEffect } from 'react';
import csrApi from '../../services/csrApiService';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [statusFilter, setStatus] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await csrApi.findAllPayments({ status: statusFilter || undefined });
      setPayments(res.payments || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fulfilled = payments.filter(p => p.status === 'fulfilled').reduce((s, p) => s + p.amount, 0);
  const failed    = payments.filter(p => p.status === 'failed').reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <h1 className="page-title">Payments</h1>

      <div className="cards-row">
        <div className="stat-card"><div className="stat-value">{payments.length}</div><div className="stat-label">Total Payments</div></div>
        <div className="stat-card"><div className="stat-value">${fulfilled.toFixed(2)}</div><div className="stat-label">Fulfilled</div></div>
        <div className="stat-card"><div className="stat-value">${failed.toFixed(2)}</div><div className="stat-label">Failed</div></div>
      </div>

      <form className="filter-bar" onSubmit={e => { e.preventDefault(); load(); }}>
        <label>
          Status
          <select value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary">Filter</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      <table className="data-table">
        <thead>
          <tr><th>Payment ID</th><th>Order ID</th><th>Amount</th><th>Status</th><th>Type</th><th>Date</th></tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p._id}>
              <td><code style={{ fontSize: '0.75rem' }}>{p._id}</code></td>
              <td><code style={{ fontSize: '0.75rem' }}>{p.orderId}</code></td>
              <td>${(p.amount || 0).toFixed(2)}</td>
              <td><span className={`badge badge-${p.status === 'fulfilled' ? 'success' : 'danger'}`}>{p.status}</span></td>
              <td>{p.type}</td>
              <td>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}</td>
            </tr>
          ))}
          {!loading && payments.length === 0 && <tr><td colSpan={6} className="empty-state">No payments found.</td></tr>}
        </tbody>
      </table>

      {loading && <p style={{ color: '#718096', marginTop: '1rem' }}>Loading…</p>}
    </>
  );
}
