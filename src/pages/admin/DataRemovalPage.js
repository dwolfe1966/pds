import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Admin page to manage data removal requests.
 */
const DataRemovalPage = () => {
  const { token } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      try {
        const data = await api.get('/admin/data-removal', { token });
        setRequests(data?.data || data.results || data.requests || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [token]);

  const handleApprove = async (id) => {
    try {
      await api.post(`/admin/data-removal/${id}/approve`, { token });
      setRequests(requests.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReject = async (id) => {
    try {
      await api.post(`/admin/data-removal/${id}/reject`, { body: { reason: 'Not eligible' }, token });
      setRequests(requests.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Data Removal Requests</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {requests.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Request ID</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>User</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Date</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{r.id}</td>
                <td>{r.userId}</td>
                <td>{r.requestedAt || r.date}</td>
                <td>
                  <button onClick={() => handleApprove(r.id)} style={{ marginRight: '0.5rem' }}>Approve</button>
                  <button onClick={() => handleReject(r.id)}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !loading ? (
        <p>No requests.</p>
      ) : null}
    </main>
  );
};

export default DataRemovalPage;