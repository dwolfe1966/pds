import React, { useEffect, useState } from 'react';
import api from '../../api';

/**
 * Admin page to manage data removal / opt-out requests via BC CSR API.
 * BC fields: _id, email, status, createdAt
 */
const DataRemovalPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      try {
        const res = await api.adminListDataRemoval();
        setRequests(res?.data || res?.raws || res?.optOuts || (Array.isArray(res) ? res : []));
      } catch (err) {
        setError(err.message || 'Failed to load data removal requests');
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, []);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Data Removal Requests</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && requests.length === 0 && <p>No requests.</p>}
      {requests.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Request ID</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Email</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Status</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => {
              const rid = r._id || r.id;
              return (
                <tr key={rid} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{rid}</td>
                  <td style={{ padding: '0.5rem' }}>{r.email || r.userId || '—'}</td>
                  <td style={{ padding: '0.5rem' }}>{r.status || '—'}</td>
                  <td style={{ padding: '0.5rem' }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : (r.requestedAt || r.date || '—')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
};

export default DataRemovalPage;
