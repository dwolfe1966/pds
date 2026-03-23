import React, { useState, useEffect } from 'react';
import csrApi from '../../services/csrApiService';

export default function OptOutPhonePage() {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [phoneFilter, setPhone] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      // TODO BC API: no phone-specific opt-out endpoint yet — using general optOut.find
      const res = await csrApi.findOptOuts({ provider: 'phone' });
      setItems(res.optOuts || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h1 className="page-title">Phone Opt-Out Requests</h1>

      <form className="filter-bar" onSubmit={e => { e.preventDefault(); load(); }}>
        <label>Phone<input type="text" value={phoneFilter} onChange={e => setPhone(e.target.value)} placeholder="Filter by phone" /></label>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      <table className="data-table">
        <thead><tr><th>Date</th><th>ID</th><th>Brand</th><th>Provider</th><th>Target ID</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {items.map(o => (
            <tr key={o._id}>
              <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
              <td><code style={{ fontSize: '0.73rem' }}>{o._id?.substring(0,12)}…</code></td>
              <td>{o.brandId}</td>
              <td>{o.provider}</td>
              <td>{o.targetId}</td>
              <td><span className={`badge badge-${o.status === 'active' ? 'success' : 'warning'}`}>{o.status}</span></td>
              <td><button className="btn btn-primary btn-sm">Approve</button></td>
            </tr>
          ))}
          {!loading && items.length === 0 && <tr><td colSpan={7} className="empty-state">No phone opt-out requests found.</td></tr>}
        </tbody>
      </table>

      {loading && <p style={{ color: '#718096', marginTop: '1rem' }}>Loading…</p>}
    </>
  );
}
