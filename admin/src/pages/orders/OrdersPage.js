import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import csrApi from '../../services/csrApiService';

export default function OrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const [userIdFilter, setUserId]       = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await csrApi.findUserOrders({ userId: userIdFilter || undefined });
      let orders = res.orders || [];
      if (statusFilter) orders = orders.filter(o => o.status === statusFilter);
      if (typeFilter)   orders = orders.filter(o => (o.type || '').toLowerCase() === typeFilter.toLowerCase());
      setOrders(orders);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total   = orders.reduce((s, o) => s + (o.amount || 0), 0);
  const failed  = orders.filter(o => o.status === 'failed').length;

  return (
    <>
      <h1 className="page-title">Orders</h1>

      <div className="cards-row">
        <div className="stat-card"><div className="stat-value">{orders.length}</div><div className="stat-label">Total Orders</div></div>
        <div className="stat-card"><div className="stat-value">${total.toFixed(2)}</div><div className="stat-label">Total Revenue</div></div>
        <div className="stat-card"><div className="stat-value">{failed}</div><div className="stat-label">Failed Orders</div></div>
      </div>

      <form className="filter-bar" onSubmit={e => { e.preventDefault(); load(); }}>
        <label>
          Status
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          Type
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All</option>
            <option value="Sale">Sale</option>
            <option value="Validate">Validate</option>
          </select>
        </label>
        <label>
          User ID (optional)
          <input type="text" value={userIdFilter} onChange={e => setUserId(e.target.value)} placeholder="Filter by user ID" />
        </label>
        <button type="submit" className="btn btn-primary">Apply</button>
        <button type="button" className="btn btn-secondary" onClick={() => { setStatusFilter(''); setTypeFilter(''); setUserId(''); setOrders([]); load(); }}>Clear</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      <table className="data-table">
        <thead>
          <tr><th>Brand</th><th>Order ID</th><th>Amount</th><th>Status</th><th>Type</th><th>Date</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {orders.map(o => (
            <tr key={o._id}>
              <td>IDLookup</td>
              <td><code style={{ fontSize: '0.75rem' }}>{o._id}</code></td>
              <td>${(o.amount || 0).toFixed(2)}</td>
              <td><span className={`badge badge-${o.status === 'active' ? 'success' : o.status === 'failed' ? 'danger' : 'neutral'}`}>{o.status}</span></td>
              <td>{o.type}</td>
              <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
              <td>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/orders/${o._id}`)}>View</button>
              </td>
            </tr>
          ))}
          {!loading && orders.length === 0 && <tr><td colSpan={7} className="empty-state">No orders found.</td></tr>}
        </tbody>
      </table>

      {loading && <p style={{ color: '#718096', marginTop: '1rem' }}>Loading…</p>}
    </>
  );
}
