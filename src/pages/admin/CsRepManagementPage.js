import React, { useEffect, useState } from 'react';
import api from '../../api';

/**
 * Admin page to manage CS representatives via BC CSR API.
 * BC fields: _id, firstName, lastName, email, roles, status
 */
const CsRepManagementPage = () => {
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  useEffect(() => {
    fetchReps();
  }, []);

  const fetchReps = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.adminListCsReps();
      setReps(res?.data || res?.raws || res?.users || (Array.isArray(res) ? res : []));
    } catch (err) {
      setError(err.message || 'Failed to load CS reps');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg('');
    try {
      await api.adminCreateCsRep({ ...form, roles: ['csr'] });
      setFormMsg('CS rep created.');
      setForm({ firstName: '', lastName: '', email: '', password: '' });
      setShowForm(false);
      await fetchReps();
    } catch (err) {
      setFormMsg(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { display: 'block', width: '100%', padding: '0.4rem', marginBottom: '0.75rem', border: '1px solid #d1d5db', borderRadius: '4px' };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>CS Representative Management</h1>

      <button
        onClick={() => setShowForm((v) => !v)}
        style={{ marginBottom: '1rem', padding: '0.5rem 1rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
      >
        {showForm ? 'Cancel' : '+ Add CS Rep'}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} style={{ maxWidth: '400px', marginBottom: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
          <h3 style={{ marginTop: 0 }}>New CS Rep</h3>
          <input style={inputStyle} placeholder="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          <input style={inputStyle} placeholder="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          <input style={inputStyle} placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input style={inputStyle} placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          <button type="submit" disabled={submitting} style={{ padding: '0.5rem 1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
          {formMsg && <p style={{ marginTop: '0.5rem', color: formMsg.startsWith('Error') ? 'red' : 'green' }}>{formMsg}</p>}
        </form>
      )}

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && reps.length === 0 && <p>No representatives found.</p>}
      {reps.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Name</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Email</th>
              <th style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left', padding: '0.5rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((r) => {
              const rid = r._id || r.id;
              const name = r.firstName ? `${r.firstName} ${r.lastName || ''}`.trim() : (r.name || rid);
              return (
                <tr key={rid} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{name}</td>
                  <td style={{ padding: '0.5rem' }}>{r.email}</td>
                  <td style={{ padding: '0.5rem' }}>{r.status || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
};

export default CsRepManagementPage;
