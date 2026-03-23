import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import csrApi from '../../services/csrApiService';

function statusBadge(status) {
  const cls = status === 'active' ? 'badge-success' : status === 'failed' ? 'badge-danger' : 'badge-neutral';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [emailFilter, setEmail]   = useState('');
  const [lastId, setLastId]       = useState(null);
  const [hasMore, setHasMore]     = useState(false);

  const load = async (reset = false) => {
    setLoading(true);
    setError('');
    try {
      const res = await csrApi.findUsers({ email: emailFilter || undefined, lastId: reset ? null : lastId });
      const users = res.users || [];
      setCustomers(prev => reset ? users : [...prev, ...users]);
      setHasMore(users.length === 20);
      if (users.length > 0) setLastId(users[users.length - 1]._id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilter = (e) => { e.preventDefault(); setLastId(null); load(true); };

  return (
    <>
      <h1 className="page-title">Customers</h1>

      <form className="filter-bar" onSubmit={handleFilter}>
        <label>
          Email
          <input type="text" value={emailFilter} onChange={e => setEmail(e.target.value)} placeholder="Search by email" />
        </label>
        <button type="submit" className="btn btn-primary">Filter</button>
        <button type="button" className="btn btn-secondary" onClick={() => { setEmail(''); setLastId(null); load(true); }}>Clear</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      <table className="data-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Card Ending</th>
            <th>Member Since</th>
            <th>Status</th>
            <th>Subscription</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {customers.map(c => (
            <tr key={c._id}>
              <td>{c.email}</td>
              <td>{c.firstName} {c.lastName}</td>
              <td>****</td>
              <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
              <td>{statusBadge(c.status)}</td>
              <td>{statusBadge(c.subscription?.status || 'inactive')}</td>
              <td>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/customers/${c._id}`)}>
                  View
                </button>
              </td>
            </tr>
          ))}
          {!loading && customers.length === 0 && (
            <tr><td colSpan={7} className="empty-state">No customers found.</td></tr>
          )}
        </tbody>
      </table>

      {loading && <p style={{ color: '#718096', marginTop: '1rem' }}>Loading…</p>}

      {hasMore && !loading && (
        <div className="load-more">
          <button className="btn btn-secondary" onClick={() => load(false)}>Load More</button>
        </div>
      )}
    </>
  );
}
