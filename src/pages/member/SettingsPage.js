import React, { useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Settings page for changing password and privacy preferences.
 */
const SettingsPage = () => {
  const { token } = useAuth();
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [privacy, setPrivacy] = useState({ searchable: true });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await api.post('/auth/change-password', { body: passwordForm, token });
      setMessage('Password changed successfully');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacyToggle = async () => {
    const newSearchable = !privacy.searchable;
    setPrivacy({ searchable: newSearchable });
    try {
      await api.put('/privacy', { body: { searchable: newSearchable }, token });
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Settings</h1>
      <section style={{ marginBottom: '2rem' }}>
        <h2>Change Password</h2>
        <form onSubmit={handlePasswordChange} style={{ maxWidth: '400px' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label>Current Password</label>
            <input
              type="password"
              name="currentPassword"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>New Password</label>
            <input
              type="password"
              name="newPassword"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </section>
      <section>
        <h2>Privacy</h2>
        <label>
          <input type="checkbox" checked={privacy.searchable} onChange={handlePrivacyToggle} /> Allow my information to be searchable
        </label>
      </section>
      {message && <p style={{ marginTop: '1rem', color: message.includes('successfully') ? 'green' : 'red' }}>{message}</p>}
    </main>
  );
};

export default SettingsPage;