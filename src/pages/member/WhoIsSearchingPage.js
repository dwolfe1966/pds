import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

const WhoIsSearchingPage = () => {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvents = async () => {
      if (!token) { setLoading(false); return; }
      setLoading(true);
      try {
        const data = await api.get('/searches/lookups-of-me', { token });
        setEvents(data?.data || []);
      } catch (err) {
        // BC session users hit the mock server and get 401 — show empty state, not an error
        if (!err.isMockUnavailable) {
          setError(err?.message || 'Unable to load lookup data.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [token]);

  const formatDate = (ts) => {
    try {
      return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: '#0d5d2f', margin: '0 0 0.5rem', fontSize: '1.75rem', fontWeight: 700 }}>
          Who's Searching For You
        </h1>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '0.95rem' }}>
          See when other members search for someone matching your profile.
        </p>
      </div>

      {loading && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: '#f3f4f6', borderRadius: '0.75rem', height: '72px', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div style={{
          padding: '1rem 1.25rem',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.75rem',
          color: '#dc2626',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div style={{
          padding: '3rem 1.5rem',
          textAlign: 'center',
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
          <p style={{ color: '#374151', fontWeight: 600, margin: '0 0 0.35rem' }}>No lookups in the last 30 days</p>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '0.875rem' }}>
            When someone searches for a person matching your profile, it will appear here.
          </p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {events.map((ev) => (
              <div
                key={ev.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  padding: '1rem 1.25rem',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem', flexShrink: 0
                  }}>
                    🔍
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: '#111827', fontSize: '0.9375rem' }}>
                      {ev.searcherLocation || 'Unknown location'}
                    </p>
                    <span style={{
                      display: 'inline-block',
                      marginTop: '0.2rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: ev.searcherMembershipLevel === 'premium' || ev.searcherMembershipLevel === 'enterprise'
                        ? '#fef9c3' : '#f3f4f6',
                      color: ev.searcherMembershipLevel === 'premium' || ev.searcherMembershipLevel === 'enterprise'
                        ? '#713f12' : '#6b7280'
                    }}>
                      {ev.searcherMembershipLevel === 'premium' || ev.searcherMembershipLevel === 'enterprise'
                        ? 'Pro Member' : 'Basic Member'}
                    </span>
                  </div>
                </div>
                <span style={{ color: '#9ca3af', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                  {formatDate(ev.timestamp)}
                </span>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.8rem', marginTop: '1.5rem' }}>
            Exact searcher identities are never revealed to protect member privacy.
          </p>
        </>
      )}
    </main>
  );
};

export default WhoIsSearchingPage;
