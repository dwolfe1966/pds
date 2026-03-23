import React, { useState, useEffect } from 'react';
import csrApi from '../../services/csrApiService';

const ROLES = ['admin', 'csr'];

export default function UserManagementPage() {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [msg, setMsg]       = useState('');
  const [modal, setModal]   = useState(null); // null | 'create' | { user } (edit)
  const [form, setForm]     = useState({ email: '', password: '', firstName: '', lastName: '', roles: [] });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await csrApi.findAdminUsers();
      setUsers(res.users || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm({ email: '', password: '', firstName: '', lastName: '', roles: [] });
    setModal('create');
  };

  const openEdit = (user) => {
    setForm({ email: user.email, password: '', firstName: user.firstName, lastName: user.lastName, roles: user.roles || [] });
    setModal(user);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      if (modal === 'create') {
        await csrApi.createAdminUser(form);
        setMsg('User created.');
      } else {
        await csrApi.updateAdminUser({ userId: modal._id, ...form });
        setMsg('User updated.');
      }
      setModal(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const toggleRole = (role) => {
    setForm(prev => ({
      ...prev,
      roles: prev.roles.includes(role) ? prev.roles.filter(r => r !== role) : [...prev.roles, role],
    }));
  };

  return (
    <>
      <h1 className="page-title">User Management</h1>

      <div className="filter-bar">
        <button className="btn btn-primary" onClick={openCreate}>+ Add User</button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {msg   && <div className="success-msg">{msg}</div>}

      <table className="data-table">
        <thead>
          <tr><th>Email</th><th>First Name</th><th>Last Name</th><th>Role</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u._id}>
              <td>{u.email}</td>
              <td>{u.firstName}</td>
              <td>{u.lastName}</td>
              <td>{(u.roles || []).join(', ') || '—'}</td>
              <td>
                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>Edit</button>
              </td>
            </tr>
          ))}
          {!loading && users.length === 0 && <tr><td colSpan={5} className="empty-state">No admin users found.</td></tr>}
        </tbody>
      </table>

      {loading && <p style={{ color: '#718096', marginTop: '1rem' }}>Loading…</p>}

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2>{modal === 'create' ? 'Add User' : 'Edit User'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label>First Name</label><input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} required /></div>
                <div className="form-group"><label>Last Name</label><input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} required /></div>
              </div>
              <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required /></div>
              <div className="form-group"><label>{modal === 'create' ? 'Password' : 'New Password (leave blank to keep)'}</label><input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required={modal === 'create'} /></div>
              <div className="form-group">
                <label>Roles</label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                  {ROLES.map(r => (
                    <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={form.roles.includes(r)} onChange={() => toggleRole(r)} />
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="btn-row">
                <button type="submit" className="btn btn-primary">{modal === 'create' ? 'Create' : 'Save'}</button>
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
