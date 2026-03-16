import React, { useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './SettingsPage.module.css';

/**
 * Settings page for changing password and privacy preferences.
 */
const SettingsPage = () => {
  const { token } = useAuth();
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [privacy, setPrivacy] = useState({ searchable: true });
  const [notifPrefs, setNotifPrefs] = useState({ emailAlerts: true, weeklyDigest: false, marketingEmails: false });
  const [loading, setLoading] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [notifMessage, setNotifMessage] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      setMessage('New password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      await api.post('/auth/change-password', { body: passwordForm, token });
      setMessage('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNotifSave = async () => {
    setNotifLoading(true);
    setNotifMessage('');
    try {
      await api.post('/notifications', { body: notifPrefs, token });
      setNotifMessage('Preferences saved successfully');
    } catch (err) {
      setNotifMessage(err.message || 'Failed to save preferences');
    } finally {
      setNotifLoading(false);
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

  const isSuccess = message.includes('successfully');

  return (
    <main className={styles.pageWrapper}>
      <h1 className={styles.pageTitle}>Settings</h1>

      <div className={styles.settingsGrid}>
        {/* Change Password */}
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Change Password</h2>
          <form onSubmit={handlePasswordChange}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="currentPassword">Current Password</label>
              <input
                id="currentPassword"
                type="password"
                name="currentPassword"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
                className={styles.input}
              />
            </div>
            <button type="submit" disabled={loading} className={styles.saveBtn}>
              {loading ? 'Changing…' : 'Change Password'}
            </button>
            {message && (
              <p className={isSuccess ? styles.successMsg : styles.errorMsg}>{message}</p>
            )}
          </form>
        </div>

        {/* Privacy */}
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Privacy</h2>
          <div className={styles.toggleRow}>
            <input
              id="searchable"
              type="checkbox"
              checked={privacy.searchable}
              onChange={handlePrivacyToggle}
            />
            <label className={styles.toggleLabel} htmlFor="searchable">
              Allow my information to be searchable
            </label>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Notification Preferences</h2>
          {(['emailAlerts', 'weeklyDigest', 'marketingEmails']).map((key) => (
            <div key={key} className={styles.toggleRow} style={{ marginBottom: '0.75rem' }}>
              <input
                id={key}
                type="checkbox"
                checked={notifPrefs[key]}
                onChange={() => setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }))}
              />
              <label className={styles.toggleLabel} htmlFor={key}>
                {key === 'emailAlerts' && 'Email me when an alert is triggered'}
                {key === 'weeklyDigest' && 'Weekly activity digest'}
                {key === 'marketingEmails' && 'Promotional emails and special offers'}
              </label>
            </div>
          ))}
          <button
            type="button"
            onClick={handleNotifSave}
            disabled={notifLoading}
            className={styles.saveBtn}
          >
            {notifLoading ? 'Saving…' : 'Save Preferences'}
          </button>
          {notifMessage && (
            <p className={notifMessage.includes('successfully') ? styles.successMsg : styles.errorMsg}>
              {notifMessage}
            </p>
          )}
        </div>
      </div>
    </main>
  );
};

export default SettingsPage;