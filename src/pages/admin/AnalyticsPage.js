import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';

/**
 * Admin dashboard showing aggregated metrics.
 */
const AnalyticsPage = () => {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [eventSummary, setEventSummary] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const data = await api.get('/admin/analytics', { token });
        setMetrics(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, [token]);

  useEffect(() => {
    fetch('http://localhost:3001/api/v1/admin/events/summary')
      .then(r => r.json())
      .then(data => setEventSummary(data))
      .catch(() => {});
  }, []);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Analytics</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {metrics && (
        <div>
          <p>Total Searches: {metrics.totalSearches}</p>
          <p>New Users: {metrics.newUsers}</p>
          <p>Revenue: {metrics.revenue}</p>
          {/* Additional charts and KPIs would be displayed here */}
        </div>
      )}

      {eventSummary && (
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Conversion Funnel</h2>
          <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
              {eventSummary.totalEvents} total events · {eventSummary.uniqueSessions} unique sessions
            </p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={eventSummary.funnel} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="step" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0d5d2f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {eventSummary && eventSummary.daily && eventSummary.daily.length > 0 && (
        <section style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Daily Activity (last 14 days)</h2>
          <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={eventSummary.daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#0d5d2f" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </main>
  );
};

export default AnalyticsPage;
