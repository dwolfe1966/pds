import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

const SearchHistoryPage = () => {
  const { token } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get('/searches/me', { token });
        setHistory(response?.data || []);
      } catch (err) {
        setError(err?.message || 'Unable to load search history.');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [token]);

  const formatQuery = (query) => {
    if (!query) return 'Search';
    if (query.firstName || query.lastName) {
      return `${query.firstName || ''} ${query.lastName || ''}`.trim();
    }
    if (query.email) return query.email;
    if (query.phone) return query.phone;
    return 'Search';
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ color: '#0d5d2f', margin: 0 }}>Search History</h1>
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
            Review your recent searches and results.
          </p>
        </div>
        <Link to="/dashboard" style={{ color: '#0d5d2f', fontWeight: 600, textDecoration: 'none' }}>
          Back to Dashboard
        </Link>
      </div>

      {loading && <p>Loading search history…</p>}
      {error && <p style={{ color: '#dc3545' }}>{error}</p>}

      {!loading && !error && history.length === 0 && (
        <p style={{ color: '#6b7280' }}>No searches yet. Start a search to populate your history.</p>
      )}

      {!loading && history.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {history.map((item) => (
            <div
              key={item.id}
              style={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '0.75rem',
                padding: '1rem 1.25rem',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: '#111827' }}>
                    {formatQuery(item.query)} {item.query?.state ? `• ${item.query.state}` : ''}
                  </p>
                  <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                    {item.type || 'name'} search • {item.resultCount || 0} results
                  </p>
                </div>
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                  {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recently'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default SearchHistoryPage;
