import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Admin page listing all active and past sessions.
 */
const SessionsPage = () => {
  const { token } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      try {
        const data = await api.get('/admin/sessions', { token });
        setSessions(data?.data || data.results || data.sessions || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, [token]);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Sessions</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {sessions.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left' }}>User</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left' }}>IP</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left' }}>Started</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                <td>{s.userId}</td>
                <td>{s.ipAddress}</td>
                <td>{s.createdAt || s.startedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !loading ? (
        <p>No sessions found.</p>
      ) : null}
    </main>
  );
};

export default SessionsPage;