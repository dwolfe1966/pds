import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Admin dashboard showing aggregated metrics.
 */
const AnalyticsPage = () => {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    </main>
  );
};

export default AnalyticsPage;