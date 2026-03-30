import React, { useState } from 'react';
import api from '../../api';

/**
 * Admin page to manage CS representatives via BC CSR API.
 * Note: BC's /database/search does not support role-based filtering — the CS Rep
 * list cannot be retrieved via this API. Creation is supported; viewing existing
 * reps requires the ByteCrtrs admin panel.
 */
const CsRepManagementPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormMsg('');
    try {
      await api.adminCreateCsRep({ ...form, roles: ['csr'] });
      setFormMsg('CS rep created successfully.');
      setForm({ firstName: '', lastName: '', email: '', password: '' });
      setShowForm(false);
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

      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: 0 }}>
        Existing CS Rep accounts are managed in the{' '}
        <strong>ByteCrtrs admin panel</strong>. Use the form above to add a new CS Rep.
      </p>
    </main>
  );
};

export default CsRepManagementPage;
