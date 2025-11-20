import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Admin page for viewing a single user’s details and activity history.
 */
const UserDetailPage = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        const data = await api.get(`/admin/users/${id}`, { token });
        setUser(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchUser();
  }, [id, token]);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>User Detail</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {user && (
        <div>
          <h2>{user.fullName}</h2>
          <p>Email: {user.email}</p>
          <p>Role: {user.role}</p>
          {/* Additional details and history could be shown here */}
        </div>
      )}
    </main>
  );
};

export default UserDetailPage;