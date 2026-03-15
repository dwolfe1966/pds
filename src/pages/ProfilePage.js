import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const ProfilePage = () => {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', zip: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const data = await api.get('/me', { token });
        setProfile(data);
        setForm({ fullName: data.fullName || '', email: data.email || '', zip: data.zip || '' });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [token]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put('/me', { body: form, token });
      setProfile(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Your Profile</h1>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <form onSubmit={handleSave} style={{ maxWidth: '400px' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label>Full Name</label>
            <input type="text" name="fullName" value={form.fullName} onChange={handleChange} style={{ width: '100%', padding: '0.5rem' }} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} disabled style={{ width: '100%', padding: '0.5rem' }} />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>ZIP Code</label>
            <input type="text" name="zip" value={form.zip} onChange={handleChange} style={{ width: '100%', padding: '0.5rem' }} />
          </div>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      )}
    </main>
  );
};

export default ProfilePage;