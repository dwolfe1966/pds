import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Displays a list of events where other users searched for the current member.
 */
const WhoIsSearchingPage = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        const data = await api.get('/searches/me', { token });
        setEvents(data?.data || data.results || data.searches || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [token]);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Who Is Searching For You</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {events.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {events.map((ev, idx) => (
            <li key={idx} style={{ borderBottom: '1px solid #eee', padding: '0.5rem 0' }}>
              {ev.timestamp} – {ev.searcherLocation || ev.location} – {ev.searcherId || 'anonymous'}
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <p>No recent searches.</p>
      ) : null}
    </main>
  );
};

export default WhoIsSearchingPage;