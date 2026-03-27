import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../api';

/**
 * Admin page for viewing a single user's details via BC CSR API.
 * BC fields: _id, firstName, lastName, email, status, createdAt, roles
 */
const UserDetailPage = () => {
  const { id } = useParams();
  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suspending, setSuspending] = useState(false);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      try {
        const [userRes, ordersRes] = await Promise.allSettled([
          api.adminGetUser(id),
          api.adminListPurchases({ userId: id }),
        ]);
        if (userRes.status === 'fulfilled') setUser(userRes.value);
        if (ordersRes.status === 'fulfilled') {
          const ord = ordersRes.value;
          setOrders(ord?.data || ord?.raws || ord?.orders || (Array.isArray(ord) ? ord : []));
        }
      } catch (err) {
        setError(err.message || 'Failed to load user');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchUser();
  }, [id]);

  const handleSuspend = async () => {
    setSuspending(true);
    setActionMsg('');
    try {
      await api.adminSuspendUser(id);
      setActionMsg('User suspended.');
      setUser((u) => u ? { ...u, status: 'suspended' } : u);
    } catch (err) {
      setActionMsg(`Error: ${err.message}`);
    } finally {
      setSuspending(false);
    }
  };

  const name = user
    ? (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.fullName || user.email)
    : '';

  return (
    <main style={{ padding: '2rem' }}>
      <h1>User Detail</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {user && (
        <div>
          <h2>{name}</h2>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Status:</strong> {user.status || user.transient?.status || '—'}</p>
          <p><strong>Role:</strong> {user.role || (Array.isArray(user.roles) ? user.roles.join(', ') : '—')}</p>
          <p><strong>Created:</strong> {user.createdAt ? new Date(user.createdAt).toLocaleString() : '—'}</p>

          {user.status !== 'suspended' && (
            <button
              onClick={handleSuspend}
              disabled={suspending}
              style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              {suspending ? 'Suspending…' : 'Suspend User'}
            </button>
          )}
          {actionMsg && <p style={{ marginTop: '0.5rem', color: actionMsg.startsWith('Error') ? 'red' : 'green' }}>{actionMsg}</p>}

          {orders.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <h3>Orders</h3>
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
                  {orders.map((o) => {
                    const oid = o._id || o.id;
                    const collected = o.transient?.amount?.collected;
                    return (
                      <tr key={oid} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>
                          <Link to={`/admin/purchases/${oid}?userId=${id}`}>{oid}</Link>
                        </td>
                        <td style={{ padding: '0.5rem' }}>{o.status || '—'}</td>
                        <td style={{ padding: '0.5rem' }}>{collected != null ? `$${collected.toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '0.5rem' }}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default UserDetailPage;
