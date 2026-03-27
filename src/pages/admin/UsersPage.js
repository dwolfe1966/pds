import React, { useEffect, useState } from 'react';
import api from '../../api';
import { Link } from 'react-router-dom';

/**
 * Admin page to list all users via BC CSR API.
 * BC fields: _id, firstName, lastName, email, status, createdAt
 */
const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await api.adminListUsers();
        setUsers(res?.data || res?.raws || res?.users || (Array.isArray(res) ? res : []));
      } catch (err) {
        setError(err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>All Users</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && users.length === 0 && <p>No users found.</p>}
      {users.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Name</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Email</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Status</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const uid = u._id || u.id;
              const name = u.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : (u.fullName || u.name || uid);
              return (
                <tr key={uid} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>
                    <Link to={`/admin/users/${uid}`}>{name}</Link>
                  </td>
                  <td style={{ padding: '0.5rem' }}>{u.email}</td>
                  <td style={{ padding: '0.5rem' }}>{u.status || u.transient?.status || '—'}</td>
                  <td style={{ padding: '0.5rem' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
};

export default UsersPage;
