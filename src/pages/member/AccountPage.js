import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getReportList } from '../../services/reportService';
import Skeleton from '../../components/Skeleton';
import styles from './AccountPage.module.css';

/**
 * Unified Account page combining Profile, Security & Privacy, and Subscription & Billing tabs.
 */
const AccountPage = () => {
  const navigate = useNavigate();
  const { token, subscription, isPaid, refreshSubscription } = useAuth();

  // ─── Tab state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('profile');

  // ─── Profile tab state ───────────────────────────────────────────────────────
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ fullName: '', email: '', zip: '', phone: '' });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // ─── Security & Privacy tab state ────────────────────────────────────────────
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [privacy, setPrivacy] = useState({ searchable: true });
  const [notifPrefs, setNotifPrefs] = useState({ emailAlerts: true, weeklyDigest: false, marketingEmails: false });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifMessage, setNotifMessage] = useState('');
  const [privacyMessage, setPrivacyMessage] = useState('');

  // ─── Subscription & Billing tab state ────────────────────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState('');
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [lastReportId, setLastReportId] = useState(null);
  const [hasMoreReports, setHasMoreReports] = useState(false);
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);

  // ─── Fetch: profile ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const data = await api.get('/me', { token });
        setProfile(data);
        setProfileForm({
          fullName: data.fullName || '',
          email: data.email || '',
          zip: data.zip || '',
          phone: data.phone || '',
        });
      } catch (err) {
        setProfileError(err.message || 'Failed to load profile');
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [token]);

  // ─── Fetch: notification prefs ───────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const fetchNotifPrefs = async () => {
      try {
        const data = await api.get('/notifications/preferences', { token });
        if (data) {
          setNotifPrefs({
            emailAlerts: data.emailAlerts ?? true,
            weeklyDigest: data.weeklyDigest ?? false,
            marketingEmails: data.marketingEmails ?? false,
          });
        }
      } catch {
        // Silently ignore; defaults are fine
      }
    };
    fetchNotifPrefs();
  }, [token]);

  // ─── Fetch: invoices ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const fetchInvoices = async () => {
      setInvoicesLoading(true);
      try {
        const data = await api.get('/invoices', { token });
        setInvoices(Array.isArray(data) ? data : data?.invoices || []);
      } catch (err) {
        setInvoicesError(err.message || 'Failed to load billing history');
      } finally {
        setInvoicesLoading(false);
      }
    };
    fetchInvoices();
  }, [token]);

  // ─── Fetch: reports ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetchReports().catch((err) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AccountPage] fetchReports error caught in useEffect:', err);
      }
    });
  }, [token]);

  const fetchReports = async (lastId = null) => {
    if (!token) {
      setReportsLoading(false);
      setReportsError('Not authenticated');
      return;
    }
    setReportsLoading(true);
    setReportsError('');
    try {
      const result = await getReportList({ lastId, token });
      if (result && result.success) {
        if (lastId) {
          setReports((prev) => [...prev, ...(result.reports || [])]);
        } else {
          setReports(result.reports || []);
        }
        setLastReportId(result.pagination?.lastId || null);
        setHasMoreReports(result.pagination?.hasMore || false);
      } else {
        setReportsError('Failed to load reports');
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AccountPage] Failed to fetch reports:', err?.message);
      }
      setReportsError(err?.message || err?.data?.error?.message || 'Failed to load reports');
    } finally {
      setReportsLoading(false);
    }
  };

  // ─── Profile handlers ────────────────────────────────────────────────────────
  const handleProfileChange = (e) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(false);
    setProfileError('');
    try {
      const updated = await api.put('/me', { body: profileForm, token });
      setProfile(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const getInitials = () => {
    const name = profile?.fullName || profileForm.fullName || '';
    return (
      name
        .trim()
        .split(/\s+/)
        .map((n) => n[0]?.toUpperCase() || '')
        .slice(0, 2)
        .join('') || '?'
    );
  };

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : null;

  // ─── Security & Privacy handlers ─────────────────────────────────────────────
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage('New password must be at least 8 characters.');
      return;
    }
    setPasswordLoading(true);
    setPasswordMessage('');
    try {
      await api.post('/auth/change-password', { body: passwordForm, token });
      setPasswordMessage('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setPasswordMessage(err.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePrivacyToggle = async () => {
    const newSearchable = !privacy.searchable;
    setPrivacy({ searchable: newSearchable });
    setPrivacyMessage('');
    try {
      await api.put('/privacy', { body: { searchable: newSearchable }, token });
    } catch (err) {
      setPrivacyMessage(err.message || 'Failed to update privacy setting');
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

  // ─── Subscription & Billing handlers ─────────────────────────────────────────
  const handleCancelConfirm = async () => {
    if (!token) {
      setCancelError('Not authenticated');
      return;
    }
    setShowCancelModal(false);
    try {
      await api.delete('/subscription', { token });
      refreshSubscription();
      setCancelError('');
    } catch (err) {
      setCancelError(err?.message || err?.data?.error?.message || 'Failed to cancel subscription');
    }
  };

  const handleViewReport = (commerceContentId) => {
    navigate(`/people/${commerceContentId}`);
  };

  const handleDownloadPdf = async (e, commerceContentId) => {
    e.stopPropagation();
    if (pdfDownloadingId) return;
    setPdfDownloadingId(commerceContentId);
    try {
      await api.downloadPdfReport(commerceContentId);
    } catch (err) {
      console.error('[AccountPage] PDF download failed:', err?.message);
    } finally {
      setPdfDownloadingId(null);
    }
  };

  const handleLoadMoreReports = () => {
    if (lastReportId && !reportsLoading) {
      fetchReports(lastReportId);
    }
  };

  const getReportInfo = (report) => {
    try {
      const commerceContent = report?.commerceContent || report || {};
      const teaserInput = report?.data?.teaserInput || report?.teaserInput;
      const createdAt = report?.createdAt || report?.created_at || new Date().toISOString();
      let reportName = 'Report';
      if (teaserInput) {
        if (typeof teaserInput === 'string') {
          reportName = teaserInput;
        } else if (teaserInput?.fName && teaserInput?.lName) {
          reportName = `${teaserInput.fName} ${teaserInput.lName}`;
        } else if (teaserInput?.name) {
          reportName = teaserInput.name;
        }
      }
      const id =
        commerceContent?._id ||
        commerceContent?.id ||
        report?._id ||
        report?.id ||
        `report-${Date.now()}`;
      return { id, name: reportName, createdAt, teaserInput };
    } catch (err) {
      return { id: `report-${Date.now()}`, name: 'Report', createdAt: new Date().toISOString(), teaserInput: null };
    }
  };

  // ─── Invoice status badge helper ──────────────────────────────────────────────
  const getInvoiceBadgeStyle = (status) => {
    if (!status) return {};
    const s = status.toLowerCase();
    if (s === 'paid') return { background: '#dcfce7', color: '#166534' };
    if (s === 'pending') return { background: '#fef9c3', color: '#92400e' };
    if (s === 'overdue') return { background: '#fee2e2', color: '#dc2626' };
    return { background: '#f3f4f6', color: '#374151' };
  };

  // ─── Tab styles ───────────────────────────────────────────────────────────────
  const tabBarStyle = {
    display: 'flex',
    gap: 0,
    marginBottom: '2rem',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  };

  const tabBtnBase = {
    padding: '0.75rem 1.5rem',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    flex: 1,
    transition: 'all 0.15s',
    textAlign: 'center',
  };

  const tabBtnActive = { ...tabBtnBase, background: '#0d5d2f', color: '#fff', border: 'none' };
  const tabBtnInactive = { ...tabBtnBase, background: '#fff', color: '#374151', border: '1px solid transparent' };

  const TABS = [
    { key: 'profile', label: 'Profile' },
    { key: 'security', label: 'Security & Privacy' },
    { key: 'billing', label: 'Subscription & Billing' },
  ];

  return (
    <main className={styles.pageWrapper}>
      <h1 className={styles.pageTitle}>My Account</h1>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ marginTop: 0, color: '#111827' }}>Cancel Subscription?</h3>
            <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
              Your access will remain active until the end of your billing period. After that, you will lose access
              to all reports and member features.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowCancelModal(false)}
                style={{
                  padding: '0.6rem 1.25rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelConfirm}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                }}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div style={tabBarStyle}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={activeTab === tab.key ? tabBtnActive : tabBtnInactive}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Profile</h2>

          {profileLoading ? (
            <div>
              <Skeleton variant="card" height={60} style={{ marginBottom: '0.75rem' }} />
              <Skeleton variant="card" height={60} style={{ marginBottom: '0.75rem' }} />
              <Skeleton variant="card" height={60} />
            </div>
          ) : (
            <>
              {/* Avatar + member since */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  marginBottom: '1.75rem',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#0d5d2f',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.4rem',
                    flexShrink: 0,
                  }}
                >
                  {getInitials()}
                </div>
                {memberSince && (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                    Member since {memberSince}
                  </p>
                )}
              </div>

              {/* Editable form */}
              <form onSubmit={handleProfileSave}>
                <div style={{ marginBottom: '1rem' }}>
                  <label
                    htmlFor="fullName"
                    style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                  >
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    name="fullName"
                    value={profileForm.fullName}
                    onChange={handleProfileChange}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label
                    htmlFor="email"
                    style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={profileForm.email}
                    disabled
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.95rem',
                      background: '#f9fafb',
                      color: '#9ca3af',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.3rem', display: 'block' }}>
                    Email cannot be changed
                  </span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label
                    htmlFor="zip"
                    style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                  >
                    ZIP Code
                  </label>
                  <input
                    id="zip"
                    type="text"
                    name="zip"
                    value={profileForm.zip}
                    onChange={handleProfileChange}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label
                    htmlFor="phone"
                    style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                  >
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    name="phone"
                    value={profileForm.phone}
                    onChange={handleProfileChange}
                    placeholder="(555) 555-5555"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {profileSuccess && (
                  <p style={{ color: '#166534', background: '#dcfce7', padding: '0.6rem 0.9rem', borderRadius: '0.375rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Profile updated successfully.
                  </p>
                )}
                {profileError && (
                  <p style={{ color: '#dc2626', fontSize: '0.9rem', marginBottom: '1rem' }}>{profileError}</p>
                )}

                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    padding: '0.7rem 1.75rem',
                    background: '#0d5d2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    cursor: profileSaving ? 'not-allowed' : 'pointer',
                    opacity: profileSaving ? 0.7 : 1,
                  }}
                >
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* ── SECURITY & PRIVACY TAB ───────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <>
          {/* Change Password */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Change Password</h2>
            <form onSubmit={handlePasswordChange} style={{ maxWidth: '480px' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="currentPassword"
                  style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                >
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  htmlFor="newPassword"
                  style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.3rem', display: 'block' }}>
                  Minimum 8 characters
                </span>
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                style={{
                  padding: '0.7rem 1.75rem',
                  background: '#0d5d2f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: passwordLoading ? 'not-allowed' : 'pointer',
                  opacity: passwordLoading ? 0.7 : 1,
                }}
              >
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </button>
              {passwordMessage && (
                <p
                  style={{
                    marginTop: '0.75rem',
                    fontSize: '0.9rem',
                    color: passwordMessage.includes('successfully') ? '#166534' : '#dc2626',
                    background: passwordMessage.includes('successfully') ? '#dcfce7' : '#fee2e2',
                    padding: '0.6rem 0.9rem',
                    borderRadius: '0.375rem',
                  }}
                >
                  {passwordMessage}
                </p>
              )}
            </form>
          </div>

          {/* Privacy */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Privacy</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                id="searchable"
                type="checkbox"
                checked={privacy.searchable}
                onChange={handlePrivacyToggle}
                style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
              />
              <label htmlFor="searchable" style={{ fontSize: '0.95rem', color: '#374151', cursor: 'pointer' }}>
                Allow my information to be searchable
              </label>
            </div>
            {privacyMessage && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#dc2626' }}>{privacyMessage}</p>
            )}
          </div>

          {/* Notification Preferences */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Notification Preferences</h2>
            {(['emailAlerts', 'weeklyDigest', 'marketingEmails']).map((key) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <input
                  id={key}
                  type="checkbox"
                  checked={notifPrefs[key]}
                  onChange={() => setNotifPrefs((prev) => ({ ...prev, [key]: !prev[key] }))}
                  style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                />
                <label htmlFor={key} style={{ fontSize: '0.95rem', color: '#374151', cursor: 'pointer' }}>
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
              style={{
                marginTop: '0.5rem',
                padding: '0.7rem 1.75rem',
                background: '#0d5d2f',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: notifLoading ? 'not-allowed' : 'pointer',
                opacity: notifLoading ? 0.7 : 1,
              }}
            >
              {notifLoading ? 'Saving...' : 'Save Preferences'}
            </button>
            {notifMessage && (
              <p
                style={{
                  marginTop: '0.75rem',
                  fontSize: '0.9rem',
                  color: notifMessage.includes('successfully') ? '#166534' : '#dc2626',
                  background: notifMessage.includes('successfully') ? '#dcfce7' : '#fee2e2',
                  padding: '0.6rem 0.9rem',
                  borderRadius: '0.375rem',
                }}
              >
                {notifMessage}
              </p>
            )}
          </div>
        </>
      )}

      {/* ── SUBSCRIPTION & BILLING TAB ───────────────────────────────────────── */}
      {activeTab === 'billing' && (
        <>
          {/* Subscription Section */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Subscription</h2>
            {cancelError && <p className={styles.errorText}>{cancelError}</p>}
            {isPaid && subscription ? (
              <div>
                <div className={styles.planInfo}>
                  <span>
                    <strong>Plan:</strong> {subscription.plan || 'Basic'}
                  </span>
                  <span className={`${styles.subscriptionBadge} ${styles.active}`}>Active</span>
                  <span>
                    <strong>Renewal date:</strong> {subscription.renewalDate || 'N/A'}
                  </span>
                </div>
                <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                    What&apos;s included:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#6b7280', fontSize: '0.9rem', lineHeight: '1.8' }}>
                    <li>Unlimited people searches</li>
                    <li>Full background reports</li>
                    <li>Real-time alerts when someone searches for you</li>
                    <li>PDF report downloads</li>
                    <li>Priority support</li>
                  </ul>
                </div>
                <button className={styles.cancelBtn} onClick={() => setShowCancelModal(true)}>
                  Cancel Subscription
                </button>
              </div>
            ) : (
              <div>
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>You do not have an active subscription.</p>
                <Link
                  to="/payment"
                  style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: '#0d5d2f',
                    color: '#fff',
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                >
                  Upgrade to Pro &mdash; $29.99/month
                </Link>
              </div>
            )}
          </div>

          {/* Billing History Section */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Billing History</h2>
            {invoicesLoading ? (
              <div>
                <Skeleton variant="card" height={52} style={{ marginBottom: '0.5rem' }} />
                <Skeleton variant="card" height={52} style={{ marginBottom: '0.5rem' }} />
                <Skeleton variant="card" height={52} />
              </div>
            ) : invoicesError ? (
              <p className={styles.errorText}>{invoicesError}</p>
            ) : invoices.length === 0 ? (
              <p className={styles.emptyState}>No billing history found.</p>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {invoices.map((invoice, idx) => {
                  const status = invoice.status || 'unknown';
                  const badgeStyle = getInvoiceBadgeStyle(status);
                  return (
                    <li
                      key={invoice.id || invoice._id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 0.5rem',
                        borderBottom: idx < invoices.length - 1 ? '1px solid #e5e7eb' : 'none',
                        gap: '1rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: '#374151', fontSize: '0.9rem' }}>
                        {invoice.date
                          ? (() => {
                              try {
                                return new Date(invoice.date).toLocaleDateString();
                              } catch {
                                return invoice.date;
                              }
                            })()
                          : 'N/A'}
                      </span>
                      <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.95rem' }}>
                        {invoice.amount != null
                          ? `$${(invoice.amount / 100).toFixed(2)}`
                          : invoice.amountFormatted || 'N/A'}
                      </span>
                      <span
                        style={{
                          padding: '0.2rem 0.65rem',
                          borderRadius: '9999px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          ...badgeStyle,
                        }}
                      >
                        {status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Reports Section */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Your Reports</h2>
            {reportsLoading && reports.length === 0 ? (
              <div>
                <Skeleton variant="card" height={72} style={{ marginBottom: '0.75rem' }} />
                <Skeleton variant="card" height={72} style={{ marginBottom: '0.75rem' }} />
                <Skeleton variant="card" height={72} />
              </div>
            ) : reportsError ? (
              <p className={styles.errorText}>{reportsError}</p>
            ) : reports.length === 0 ? (
              <p className={styles.emptyState}>You haven&apos;t created any reports yet.</p>
            ) : (
              <>
                <ul className={styles.reportsList}>
                  {reports.map((report, index) => {
                    const reportInfo = getReportInfo(report);
                    return (
                      <li
                        key={reportInfo.id || index}
                        className={styles.reportItem}
                        onClick={() => handleViewReport(reportInfo.id)}
                      >
                        <div>
                          <p className={styles.reportName}>{reportInfo.name}</p>
                          <p className={styles.reportDate}>
                            Created:{' '}
                            {(() => {
                              try {
                                const date = new Date(reportInfo.createdAt);
                                if (isNaN(date.getTime())) return 'Unknown date';
                                return date.toLocaleDateString();
                              } catch {
                                return 'Unknown date';
                              }
                            })()}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            className={styles.viewBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewReport(reportInfo.id);
                            }}
                          >
                            View Report
                          </button>
                          <button
                            className={styles.viewBtn}
                            style={{ background: 'transparent', color: '#0d5d2f', border: '1px solid #0d5d2f' }}
                            onClick={(e) => handleDownloadPdf(e, reportInfo.id)}
                            disabled={pdfDownloadingId === reportInfo.id}
                            title="Download PDF"
                          >
                            {pdfDownloadingId === reportInfo.id ? '...' : 'PDF'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {hasMoreReports ? (
                  <button
                    className={styles.loadMoreBtn}
                    onClick={handleLoadMoreReports}
                    disabled={reportsLoading}
                  >
                    {reportsLoading ? 'Loading...' : 'Load More Reports'}
                  </button>
                ) : (
                  reports.length > 0 && (
                    <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
                      All reports loaded
                    </p>
                  )
                )}
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
};

export default AccountPage;
