import React, { useEffect, useState } from 'react';
import api from '../../api';
import { Link } from 'react-router-dom';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [lastId, setLastId] = useState(null);
  const [noMoreDocs, setNoMoreDocs] = useState(false);

  const fetchPage = async (cursorId = null) => {
    const params = cursorId ? { lastId: cursorId } : {};
    const res = await api.adminListUsers(params);
    const docs = res?.data || [];
    const last = docs[docs.length - 1]?._id || docs[docs.length - 1]?.id || null;
    return { docs, last, noMoreDocs: res?.noMoreDocs ?? docs.length === 0 };
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { docs, last, noMoreDocs: done } = await fetchPage();
        setUsers(docs);
        setLastId(last);
        setNoMoreDocs(done);
      } catch (err) {
        setError(err.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const { docs, last, noMoreDocs: done } = await fetchPage(lastId);
      setUsers(prev => [...prev, ...docs]);
      setLastId(last);
      setNoMoreDocs(done);
    } catch (err) {
      setError(err.message || 'Failed to load more users');
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>All Users</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && users.length === 0 && <p>No users found.</p>}
      {users.length > 0 && (
        <>
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
          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{users.length} users loaded</span>
            {!noMoreDocs && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                style={{ padding: '0.4rem 1rem', cursor: loadingMore ? 'not-allowed' : 'pointer' }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
            {noMoreDocs && <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>All users loaded</span>}
          </div>
        </>
      )}
    </main>
  );
};

export default UsersPage;
