import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import csrApi from '../../services/csrApiService';

export default function ManageNotesPage() {
  const navigate  = useNavigate();
  const [notes, setNotes]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [msg, setMsg]         = useState('');
  const [editNote, setEditNote] = useState(null);
  const [searchUserId, setSearchUserId] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await csrApi.findAdminNotes({ userId: searchUserId || undefined });
      setNotes(res.notes || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpdate = async () => {
    if (!editNote) return;
    try {
      await csrApi.updateAdminNote({ messageId: editNote._id, message: editNote.message });
      setNotes(prev => prev.map(n => n._id === editNote._id ? { ...n, message: editNote.message } : n));
      setEditNote(null);
      setMsg('Note updated.');
    } catch (err) { setError(err.message); }
  };

  return (
    <>
      <h1 className="page-title">Manage Notes</h1>

      <form className="filter-bar" onSubmit={e => { e.preventDefault(); load(); }}>
        <label>
          Customer User ID
          <input type="text" value={searchUserId} onChange={e => setSearchUserId(e.target.value)} placeholder="Filter by user ID" />
        </label>
        <button type="submit" className="btn btn-primary">Search</button>
        <button type="button" className="btn btn-secondary" onClick={() => { setSearchUserId(''); load(); }}>Clear</button>
      </form>

      {error && <div className="error-msg">{error}</div>}
      {msg   && <div className="success-msg">{msg}</div>}

      <table className="data-table">
        <thead>
          <tr><th>Brand</th><th>Note ID</th><th>User ID</th><th>Date</th><th>Note</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {notes.map(n => (
            <tr key={n._id}>
              <td>IDLookup</td>
              <td><code style={{ fontSize: '0.75rem' }}>{n._id}</code></td>
              <td>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/customers/${n.userId}`)}>
                  {n.userId}
                </button>
              </td>
              <td>{n.createdAt ? new Date(n.createdAt).toLocaleDateString() : '—'}</td>
              <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {editNote?._id === n._id
                  ? <textarea style={{ width: '100%' }} rows={2} value={editNote.message} onChange={e => setEditNote({ ...editNote, message: e.target.value })} />
                  : n.message
                }
              </td>
              <td>
                {editNote?._id === n._id
                  ? <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button className="btn btn-primary btn-sm" onClick={handleUpdate}>Save</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditNote(null)}>Cancel</button>
                    </div>
                  : <button className="btn btn-secondary btn-sm" onClick={() => setEditNote({ _id: n._id, message: n.message })}>Edit</button>
                }
              </td>
            </tr>
          ))}
          {!loading && notes.length === 0 && <tr><td colSpan={6} className="empty-state">No notes found.</td></tr>}
        </tbody>
      </table>

      {loading && <p style={{ color: '#718096', marginTop: '1rem' }}>Loading…</p>}
    </>
  );
}
