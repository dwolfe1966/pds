import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  getSearchHistory,
  deleteSearchHistoryItem,
} from '../../utils/searchHistory';
import { fetchSearchHistory, deleteServerSearch } from '../../services/searchActivity';

// Merge the cross-device server history (source of truth) with any local-only entries newer than the
// newest server row — so a search you JUST ran still shows before its capture round-trips. Deduped by a
// coarse query signature.
function mergeHistory(server, local) {
  if (!server.length) return local;
  const sig = (e) => `${e.type}|${(e.query && e.query.firstName) || ''}|${(e.query && e.query.lastName) || ''}|${(e.query && e.query.email) || ''}|${(e.query && e.query.phone) || ''}`.toLowerCase();
  const newestServer = Math.max(0, ...server.map((e) => e.timestamp || 0));
  const serverSigs = new Set(server.map(sig));
  const extras = local.filter((e) => (e.timestamp || 0) > newestServer && !serverSigs.has(sig(e)));
  return [...extras, ...server].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

const SearchHistoryPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState('');

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let alive = true;
    // Paint the local cache instantly, then reconcile with the server (cross-device, source of truth).
    const local = getSearchHistory();
    setHistory(local);
    fetchSearchHistory()
      .then((server) => { if (alive) setHistory(mergeHistory(server || [], local)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  const handleDelete = (id) => {
    deleteSearchHistoryItem(id); // local cache
    deleteServerSearch(id);      // server (best-effort; scoped to this user)
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const handleReRun = (item) => {
    const params = new URLSearchParams();
    if (item.query?.firstName) params.set('firstName', item.query.firstName);
    if (item.query?.lastName) params.set('lastName', item.query.lastName);
    if (item.query?.state) params.set('state', item.query.state);
    if (item.query?.email) params.set('email', item.query.email);
    if (item.query?.phone) params.set('phone', item.query.phone);
    navigate(`/people-search?${params.toString()}`);
  };

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: '#111827' }}>
                    {formatQuery(item.query)} {item.query?.state ? `• ${item.query.state}` : ''}
                  </p>
                  <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                    {item.type || 'name'} search • {item.resultCount || 0} results
                    {item.timestamp ? ` • ${new Date(item.timestamp).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <button
                    onClick={() => handleReRun(item)}
                    style={{
                      padding: '0.35rem 0.75rem', borderRadius: '0.375rem',
                      background: '#0d5d2f', color: '#fff', border: 'none',
                      fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500
                    }}
                  >
                    Search Again
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      padding: '0.35rem 0.75rem', borderRadius: '0.375rem',
                      background: 'transparent', color: '#6b7280',
                      border: '1px solid #e5e7eb',
                      fontSize: '0.8rem', cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default SearchHistoryPage;
