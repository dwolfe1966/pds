import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Admin page listing all purchases/subscriptions.
 */
const PurchasesPage = () => {
  const { token } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPurchases = async () => {
      setLoading(true);
      try {
        const data = await api.get('/admin/purchases', { token });
        setPurchases(data?.data || data.results || data.purchases || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, [token]);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Purchases</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {purchases.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Purchase ID</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>User ID</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>
                  <Link to={`/admin/purchases/${p.id}`}>{p.id}</Link>
                </td>
                <td>{p.userId}</td>
                <td>{p.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !loading ? (
        <p>No purchases found.</p>
      ) : null}
    </main>
  );
};

export default PurchasesPage;