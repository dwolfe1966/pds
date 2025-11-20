import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Admin page to manage customer‑service representatives (CS reps).
 */
const CsRepManagementPage = () => {
  const { token } = useAuth();
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReps = async () => {
      setLoading(true);
      try {
        const data = await api.get('/admin/cs-reps', { token });
        setReps(data.results || data.reps || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchReps();
  }, [token]);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>CS Representative Management</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {reps.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>ID</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Name</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Email</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Role</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{r.id}</td>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>{r.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !loading ? (
        <p>No representatives found.</p>
      ) : null}
    </main>
  );
};

export default CsRepManagementPage;