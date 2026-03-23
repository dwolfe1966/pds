import React, { useState, useEffect } from 'react';
import csrApi from '../../services/csrApiService';

export default function UnsubscribePage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await csrApi.findContacts({ email: search || undefined });
      setContacts(res.contacts || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <h1 className="page-title">Unsubscribe List</h1>
      <form className="filter-bar" onSubmit={e => { e.preventDefault(); load(); }}>
        <label>Email / Phone<input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search" /></label>
        <button type="submit" className="btn btn-primary">Search</button>
        <button type="button" className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-end' }}>Unsubscribe All</button>
      </form>

      {error && <div className="error-msg">{error}</div>}

      <table className="data-table">
        <thead><tr><th>Email/Phone</th><th>Date Subscribed</th><th>Date Unsubscribed</th><th>Brand</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {contacts.map(c => (
            <tr key={c._id}>
              <td>{c.email}</td>
              <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
              <td>—</td>
              <td>{c.brandId}</td>
              <td><span className={`badge badge-${c.status === 'fulfilled' ? 'success' : 'warning'}`}>{c.status}</span></td>
              <td><button className="btn btn-danger btn-sm">Unsubscribe</button></td>
            </tr>
          ))}
          {!loading && contacts.length === 0 && <tr><td colSpan={6} className="empty-state">No records found.</td></tr>}
        </tbody>
      </table>
      {loading && <p style={{ color: '#718096', marginTop: '1rem' }}>Loading…</p>}
    </>
  );
}
