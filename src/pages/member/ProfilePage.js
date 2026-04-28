import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './ProfilePage.module.css';

/**
 * Member profile page allows users to view and update editable account details.
 */
const ProfilePage = () => {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', zip: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const data = await api.get('/me', { token });
        setProfile(data);
        setForm({ fullName: data.fullName || '', email: data.email || '', zip: data.zip || '', phone: data.phone || '' });
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
    setSaveSuccess(false);
    setError('');
    try {
      const updated = await api.put('/me', { body: form, token });
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Derive initials for avatar from loaded profile or form
  const getInitials = () => {
    const name = profile?.fullName || form.fullName || '';
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0]?.toUpperCase() || '')
      .slice(0, 2)
      .join('') || '?';
  };

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : null;

  return (
    <main className={styles.pageWrapper}>
      <h1 className={styles.pageTitle}>Your Profile</h1>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className={styles.profileCard}>
          {/* Avatar */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarCircle}>{getInitials()}</div>
            {memberSince && (
              <p className={styles.memberInfo}>Member since {memberSince}</p>
            )}
          </div>

          {/* Form */}
          <div className={styles.formSection}>
            <form onSubmit={handleSave}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="fullName">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  autoComplete="name"
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  disabled
                  className={styles.input}
                />
                <span className={styles.emailNote}>Email address cannot be changed.</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="zip">ZIP Code</label>
                <input
                  id="zip"
                  type="text"
                  name="zip"
                  value={form.zip}
                  onChange={handleChange}
                  inputMode="numeric"
                  pattern="[0-9]{5}(-[0-9]{4})?"
                  maxLength={10}
                  autoComplete="postal-code"
                  placeholder="80202"
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(555) 555-5555"
                  className={styles.input}
                />
              </div>
              {saveSuccess && (
                <p className={styles.successMsg}>Profile updated successfully.</p>
              )}
              {error && <p className={styles.errorMsg}>{error}</p>}
              <button type="submit" disabled={saving} className={styles.saveBtn}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default ProfilePage;