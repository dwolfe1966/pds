import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const AccountPage = () => {
  const { token } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const data = await api.get('/subscription', { token });
        setSubscription(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSubscription();
  }, [token]);

  const handleCancel = async () => {
    try {
      await api.delete('/subscription', { token });
      setSubscription(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Account & Billing</h1>
      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : subscription ? (
        <div>
          <p>Plan: {subscription.plan}</p>
          <p>Renewal date: {subscription.renewalDate}</p>
          <button onClick={handleCancel}>Cancel Subscription</button>
        </div>
      ) : (
        <p>You do not have an active subscription.</p>
      )}
    </main>
  );
};

export default AccountPage;