import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Admin page showing details for a single purchase or subscription.
 */
const PurchaseDetailPage = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const [purchase, setPurchase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPurchase = async () => {
      setLoading(true);
      try {
        const data = await api.get(`/admin/purchases/${id}`, { token });
        setPurchase(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchPurchase();
  }, [id, token]);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Purchase Detail</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {purchase && (
        <div>
          <p>ID: {purchase.id}</p>
          <p>User: {purchase.userId}</p>
          <p>Amount: {purchase.amount}</p>
          <p>Status: {purchase.status}</p>
          {/* Additional fields such as date, payment method, etc. */}
        </div>
      )}
    </main>
  );
};

export default PurchaseDetailPage;