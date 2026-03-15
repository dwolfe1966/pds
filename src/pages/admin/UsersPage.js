import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

/**
 * Admin page to list all users.
 */
const UsersPage = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const data = await api.get('/admin/users', { token });
        setUsers(data?.data || data.results || data.users || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [token]);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>All Users</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {users.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>ID</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Name</th>
              <th style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>Email</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{u.id}</td>
                <td>
                  <Link to={`/admin/users/${u.id}`}>{u.fullName || u.name}</Link>
                </td>
                <td>{u.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !loading ? (
        <p>No users found.</p>
      ) : null}
    </main>
  );
};

export default UsersPage;