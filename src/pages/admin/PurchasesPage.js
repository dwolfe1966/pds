import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';

/**
 * Admin purchases page via BC CSR API.
 * BC's findOrders requires a userId. If ?userId= is in the URL we fetch that
 * user's orders; otherwise we show a prompt to search via the Users page.
 */
const PurchasesPage = () => {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get('userId');

  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    const fetchPurchases = async () => {
      setLoading(true);
      try {
        const res = await api.adminListPurchases({ userId });
        setPurchases(res?.data || res?.orders || (Array.isArray(res) ? res : []));
      } catch (err) {
        setError(err.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, [userId]);

  if (!userId) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>Purchases</h1>
        <p style={{ color: '#6b7280' }}>
          The BC API requires a user ID to fetch orders. Find a user on the{' '}
          <Link to="/admin/users">Users page</Link> and their orders will appear here.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Orders for user <code style={{ fontSize: '0.875rem' }}>{userId}</code></h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && purchases.length === 0 && <p>No orders found.</p>}
      {purchases.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Order ID</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Status</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Collected</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => {
              const pid = p._id || p.id;
              const collected = p.transient?.amount?.collected;
              return (
                <tr key={pid} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>
                    <Link to={`/admin/purchases/${pid}?userId=${userId}`}>{pid}</Link>
                  </td>
                  <td style={{ padding: '0.5rem' }}>{p.status}{p.transient?.canceled ? ' (canceled)' : ''}</td>
                  <td style={{ padding: '0.5rem' }}>{collected != null ? `$${collected.toFixed(2)}` : '—'}</td>
                  <td style={{ padding: '0.5rem' }}>{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
};

export default PurchasesPage;
