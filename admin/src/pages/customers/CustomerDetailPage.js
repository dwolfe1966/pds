import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import csrApi from '../../services/csrApiService';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab]       = useState('communications');
  const [user, setUser]     = useState(null);
  const [orders, setOrders] = useState([]);
  const [notes, setNotes]   = useState([]);
  const [newNote, setNewNote]   = useState('');
  const [editNote, setEditNote] = useState(null); // { _id, message }
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [msg, setMsg]           = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [uRes, oRes, nRes] = await Promise.all([
          csrApi.getUserDetail({ userId: id }),
          csrApi.findUserOrders({ userId: id }),
          csrApi.findAdminNotes({ userId: id }),
        ]);
        setUser(uRes.user);
        setOrders(oRes.orders || []);
        setNotes(nRes.notes || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      const res = await csrApi.createAdminNote({ userId: id, message: newNote.trim() });
      setNotes(prev => [res.note, ...prev]);
      setNewNote('');
      setMsg('Note added.');
    } catch (err) { setError(err.message); }
  };

  const handleUpdateNote = async () => {
    if (!editNote) return;
    try {
      await csrApi.updateAdminNote({ messageId: editNote._id, message: editNote.message });
      setNotes(prev => prev.map(n => n._id === editNote._id ? { ...n, message: editNote.message } : n));
      setEditNote(null);
      setMsg('Note updated.');
    } catch (err) { setError(err.message); }
  };

  const handleCancel = async (orderId) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      await csrApi.cancelUncancelOrder({ orderId, flag: true });
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: 'cancelled' } : o));
      setMsg('Order cancelled.');
    } catch (err) { setError(err.message); }
  };

  if (loading) return <p style={{ color: '#718096' }}>Loading…</p>;
  if (!user)   return <p className="error-msg">Customer not found.</p>;

  return (
    <>
      <button className="btn btn-secondary btn-sm" style={{ marginBottom: '1rem' }} onClick={() => navigate('/customers')}>
        ← Back to Customers
      </button>

      {/* Summary */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="two-col">
          <div className="col">
            <h2 style={{ margin: 0 }}>{user.firstName} {user.lastName}</h2>
            <p className="mini-text">Email: {user.email}</p>
            <p className="mini-text">Status: <span className={`badge badge-${user.status === 'active' ? 'success' : 'neutral'}`}>{user.status || 'unknown'}</span></p>
            <p className="mini-text">Member since: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</p>
          </div>
          <div className="col">
            <p className="mini-text">Subscription: {user.subscription?.status || 'none'}</p>
            <p className="mini-text">User ID: <code style={{ fontSize: '0.75rem' }}>{user._id}</code></p>
          </div>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {msg && <div className="success-msg">{msg}</div>}

      {/* Tabs */}
      <div className="tabs">
        {['communications', 'transactions', 'notes'].map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Communications tab */}
      {tab === 'communications' && (
        <div>
          <p className="section-title">Add Admin Note</p>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <textarea
              style={{ flex: 1 }}
              rows={2}
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Internal note (only admins can see this)…"
            />
            <button className="btn btn-primary" onClick={handleAddNote}>Add Note</button>
          </div>
          {notes.length === 0 && <p className="empty-state">No communications yet.</p>}
          {notes.map(n => (
            <div key={n._id} className="card" style={{ marginBottom: '0.75rem' }}>
              {editNote?._id === n._id ? (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <textarea
                    style={{ flex: 1 }}
                    rows={2}
                    value={editNote.message}
                    onChange={e => setEditNote({ ...editNote, message: e.target.value })}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={handleUpdateNote}>Save</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditNote(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0 }}>{n.message}</p>
                    <p className="mini-text">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditNote({ _id: n._id, message: n.message })}>Edit</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Transactions tab */}
      {tab === 'transactions' && (
        <div>
          {orders.length === 0 && <p className="empty-state">No orders found.</p>}
          <table className="data-table">
            <thead>
              <tr><th>Order ID</th><th>Amount</th><th>Status</th><th>Type</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o._id}>
                  <td><code style={{ fontSize: '0.75rem' }}>{o._id}</code></td>
                  <td>${(o.amount || 0).toFixed(2)}</td>
                  <td><span className={`badge badge-${o.status === 'active' ? 'success' : o.status === 'failed' ? 'danger' : 'neutral'}`}>{o.status}</span></td>
                  <td>{o.type}</td>
                  <td>{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '—'}</td>
                  <td style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/orders/${o._id}`)}>View</button>
                    {o.status === 'active' && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleCancel(o._id)}>Cancel</button>
                    )}
                    {o.status === 'cancelled' && (
                      <button className="btn btn-secondary btn-sm" onClick={async () => {
                        await csrApi.cancelUncancelOrder({ orderId: o._id, flag: false });
                        setOrders(prev => prev.map(x => x._id === o._id ? { ...x, status: 'active' } : x));
                      }}>Reactivate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes tab */}
      {tab === 'notes' && (
        <div>
          {notes.length === 0 && <p className="empty-state">No notes yet.</p>}
          {notes.map(n => (
            <div key={n._id} className="card" style={{ marginBottom: '0.75rem' }}>
              <p style={{ margin: 0 }}>{n.message}</p>
              <p className="mini-text">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
