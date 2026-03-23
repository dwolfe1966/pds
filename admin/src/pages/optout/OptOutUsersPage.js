import React, { useState, useEffect } from 'react';
import csrApi from '../../services/csrApiService';

export default function OptOutUsersPage() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [statusFilter, setStatus] = useState('');
  const [emailFilter, setEmail]   = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await csrApi.findOptOuts({ status: statusFilter || undefined, email: emailFilter || undefined });
      setItems(res.optOuts || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h1 className="page-title">User Opt-Out Requests</h1>
      <p className="mini-text" style={{ marginBottom: '1rem' }}>Search for a user by email or target ID and manage their opt-out status.</p>

      <form className="filter-bar" onSubmit={e => { e.preventDefault(); load(); }}>
        <label>
          Status
          <select value={statusFilter} onChange={e => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="requested">Requested</option>
            <option value="active">Active</option>
          </select>
        </label>
        <label>
          Email
          <input type="text" value={emailFilter} onChange={e => setEmail(e.target.value)} placeholder="Filter by email" />
        </label>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      <table className="data-table">
        <thead>
          <tr><th>Date</th><th>ID</th><th>Brand</th><th>Type</th><th>Provider</th><th>Email</th><th>Target ID</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {items.map(o => (
            <tr key={o._id}>
              <td>{o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</td>
              <td><code style={{ fontSize: '0.73rem' }}>{o._id?.substring(0,12)}…</code></td>
              <td>{o.brandId}</td>
              <td>{o.type}</td>
              <td>{o.provider}</td>
              <td>{o.email}</td>
              <td>{o.targetId}</td>
              <td><span className={`badge badge-${o.status === 'active' ? 'success' : 'warning'}`}>{o.status}</span></td>
              <td>
                {o.status === 'requested' && (
                  <button className="btn btn-primary btn-sm">Approve</button>
                )}
              </td>
            </tr>
          ))}
          {!loading && items.length === 0 && <tr><td colSpan={9} className="empty-state">No opt-out requests found.</td></tr>}
        </tbody>
      </table>

      {loading && <p style={{ color: '#718096', marginTop: '1rem' }}>Loading…</p>}
    </>
  );
}
