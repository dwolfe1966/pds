import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getReportList } from '../../services/reportService';
import Skeleton from '../../components/Skeleton';
import styles from './AccountPage.module.css';

/**
 * Unified Account page combining Profile, Security & Privacy, Subscription & Billing,
 * and Messages tabs.
 */
const AccountPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, user, setUser, subscription, isPaid, refreshSubscription } = useAuth();

  // ─── Tab state (supports ?tab=messages deep-linking) ────────────────────────
  // Default lands on Security & Privacy (first tab); Profile is the last tab.
  const validTabs = ['security', 'billing', 'messages', 'profile'];
  const initialTab = validTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'security';
  const [activeTab, setActiveTab] = useState(initialTab);

  // ─── Profile tab state ───────────────────────────────────────────────────────
  // BC `user.update` accepts firstName, lastName, and phone — no zip.
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
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
  // BC orders fed both the billing-history panel and the "Plan" display via
  // findOfferByShmName lookup (see fetchPlanName below).
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [planDisplayName, setPlanDisplayName] = useState('');
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [lastReportId, setLastReportId] = useState(null);
  const [hasMoreReports, setHasMoreReports] = useState(false);
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);

  // ─── Messages tab state ─────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [lastMessageId, setLastMessageId] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messagesFetched, setMessagesFetched] = useState(false);

  // ─── Compose message state ──────────────────────────────────────────────────
  const [showCompose, setShowCompose] = useState(false);
  const [composeSubject, setComposeSubject] = useState('General inquiry');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeSuccess, setComposeSuccess] = useState(false);
  const [composeError, setComposeError] = useState('');

  // ─── Fetch: profile ──────────────────────────────────────────────────────────
  // BC has no consumer GET /me equivalent — seed from the AuthContext user
  // populated at login. We still try /me as a best-effort to pick up any extra
  // fields (createdAt for "Member since"), but don't fail if it's missing.
  useEffect(() => {
    if (!token || !user) return;
    setProfileForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
    });
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const data = await api.get('/me', { token });
        if (data) {
          setProfile(data);
          setProfileForm((prev) => ({
            firstName: data.firstName || prev.firstName,
            lastName: data.lastName || prev.lastName,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
          }));
        }
      } catch {
        // Best-effort — BC doesn't expose /me, so this fetch may 404 in prod.
        // The form is already seeded from the auth user.
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [token, user]);

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

  // ─── Fetch: orders (billing history source of truth) ─────────────────────────
  // BC `billing.getOrders()` returns the user's full order list; each order
  // carries a `commercePayments[]` array we flatten into rows for the history
  // panel.
  useEffect(() => {
    if (!token) return;
    const fetchOrders = async () => {
      setOrdersLoading(true);
      try {
        const data = await api.getUserOrders();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        setOrdersError(err.message || 'Failed to load billing history');
      } finally {
        setOrdersLoading(false);
      }
    };
    fetchOrders();
  }, [token]);

  // ─── Fetch: human-readable plan name via findByShmName ──────────────────────
  // The active subscription stores the BC offer ID; the user-visible name lives
  // on the offer record (extName / commerceProducts[].name). We currently only
  // ship one offer (comp.offer.signup.main) so the shmName is fixed.
  useEffect(() => {
    if (!token || !isPaid) return;
    let cancelled = false;
    (async () => {
      try {
        const offer = await api.findOfferByShmName({ shmName: 'comp.offer.signup.main' });
        if (cancelled) return;
        const name =
          offer?.extName ||
          offer?.commerceProducts?.[0]?.extName ||
          offer?.commerceProducts?.[0]?.name ||
          offer?.name ||
          '';
        setPlanDisplayName(name);
      } catch {
        // Non-fatal — fall back to a generic "Subscription" label in render.
      }
    })();
    return () => { cancelled = true; };
  }, [token, isPaid]);

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

  // ─── Fetch: messages (lazy — only when tab is active) ─────────────────────
  useEffect(() => {
    if (!token || activeTab !== 'messages' || messagesFetched) return;
    fetchMessages();
  }, [token, activeTab, messagesFetched]);

  const fetchMessages = async (lastId = null) => {
    if (!token) return;
    setMessagesLoading(true);
    setMessagesError('');
    try {
      const result = await api.getUserContacts(lastId || undefined);
      // BC response: { messages: [...], noMoreDocs: boolean }
      // The wrapper may also return via getData() or raw shape
      const data = result?.getData?.() ?? result?.data ?? result ?? {};
      const msgs = data.messages || data.docs || (Array.isArray(data) ? data : []);
      if (lastId) {
        setMessages((prev) => [...prev, ...msgs]);
      } else {
        setMessages(msgs);
      }
      // Track pagination cursor: last message _id
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
      setLastMessageId(lastMsg?._id || null);
      setHasMoreMessages(data.noMoreDocs === false);
      setMessagesFetched(true);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AccountPage] Failed to fetch messages:', err?.message);
      }
      // Gracefully handle case where user.getContacts is not available
      setMessagesError('');
      setMessages([]);
      setMessagesFetched(true);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleLoadMoreMessages = () => {
    if (lastMessageId && !messagesLoading) {
      fetchMessages(lastMessageId);
    }
  };

  const handleComposeSubmit = async (e) => {
    e.preventDefault();
    if (!composeMessage.trim()) return;
    setComposeSending(true);
    setComposeError('');
    setComposeSuccess(false);
    try {
      // BC user.createContact only takes message + contentType; identity comes
      // from session. Prepend the subject so CSR sees both fields.
      const subject = (composeSubject || 'General inquiry').trim();
      const body = composeMessage.trim();
      const message = subject ? `[${subject}]\n\n${body}` : body;
      await api.userCreateContact({ message, contentType: 'text/plain' });
      setComposeSuccess(true);
      setComposeMessage('');
      setComposeSubject('General inquiry');
      // Refresh message list
      setMessagesFetched(false);
      setTimeout(() => {
        setShowCompose(false);
        setComposeSuccess(false);
      }, 2000);
    } catch (err) {
      setComposeError(err?.message || 'Failed to send message. Please try again.');
    } finally {
      setComposeSending(false);
    }
  };

  /**
   * Strip BC-internal Reply link HTML (contains loginHash URLs).
   * Returns sanitized HTML string safe for rendering.
   */
  const sanitizeMessageHtml = (html) => {
    if (!html) return '';
    // Remove <a> tags that contain loginHash parameter
    return html.replace(/<a[^>]*loginHash[^>]*>.*?<\/a>/gi, '');
  };

  const formatMessageDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Unknown date';
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown date';
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
      // BC user.update accepts firstName, lastName, phone — all optional.
      await api.updateProfile({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone,
      }, token);
      // Keep AuthContext.user in sync so header/dashboard reflect the new name
      // immediately (BC doesn't push the updated user back; we mirror locally).
      if (setUser && user) {
        const nextUser = {
          ...user,
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
          phone: profileForm.phone,
        };
        setUser(nextUser);
        try { localStorage.setItem('user', JSON.stringify(nextUser)); } catch { /* non-fatal */ }
      }
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const getInitials = () => {
    const first = (profileForm.firstName || user?.firstName || '').trim();
    const last = (profileForm.lastName || user?.lastName || '').trim();
    const initials = `${first[0] || ''}${last[0] || ''}`.toUpperCase();
    return initials || '?';
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
    { key: 'security', label: 'Security & Privacy' },
    { key: 'billing', label: 'Subscription & Billing' },
    { key: 'messages', label: 'Messages' },
    { key: 'profile', label: 'Profile' },
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label
                      htmlFor="firstName"
                      style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                    >
                      First Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      name="firstName"
                      value={profileForm.firstName}
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
                  <div>
                    <label
                      htmlFor="lastName"
                      style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                    >
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      name="lastName"
                      value={profileForm.lastName}
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
                  {key === 'emailAlerts' && 'Email me about my account activity'}
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
                    <strong>Plan:</strong> {planDisplayName || 'Subscription'}
                  </span>
                  <span className={`${styles.subscriptionBadge} ${styles.active}`}>Active</span>
                  <span>
                    <strong>Renewal date:</strong>{' '}
                    {subscription.dueDate
                      ? (() => {
                          try { return new Date(subscription.dueDate).toLocaleDateString(); }
                          catch { return 'N/A'; }
                        })()
                      : 'N/A'}
                  </span>
                </div>
                <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                    What&apos;s included:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#6b7280', fontSize: '0.9rem', lineHeight: '1.8' }}>
                    <li>Unlimited people searches</li>
                    <li>Full background reports</li>
                    <li>Saved search history with one-click re-pull</li>
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

          {/* Billing History Section — flat list of payments across all orders, newest first. */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Billing History</h2>
            {ordersLoading ? (
              <div>
                <Skeleton variant="card" height={52} style={{ marginBottom: '0.5rem' }} />
                <Skeleton variant="card" height={52} style={{ marginBottom: '0.5rem' }} />
                <Skeleton variant="card" height={52} />
              </div>
            ) : ordersError ? (
              <p className={styles.errorText}>{ordersError}</p>
            ) : (() => {
              const payments = orders
                .flatMap((o) => Array.isArray(o.commercePayments) ? o.commercePayments : [])
                .map((p) => ({
                  id: p._id || p.id,
                  ts: p.paymentTimestamp || (p.createdAt ? new Date(p.createdAt).getTime() : 0),
                  amount: p.totalPrice?.amount,
                  currency: (p.totalPrice?.code || 'usd').toUpperCase(),
                  type: p.type || 'sale',
                  status: p.status || 'unknown',
                }))
                .sort((a, b) => (b.ts || 0) - (a.ts || 0));
              if (payments.length === 0) {
                return <p className={styles.emptyState}>No billing history found.</p>;
              }
              return (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {payments.map((p, idx) => {
                    const badgeStyle = getInvoiceBadgeStyle(p.status);
                    const dateLabel = p.ts ? new Date(p.ts).toLocaleDateString() : 'N/A';
                    const isRefund = p.type === 'refund' || p.type === 'void';
                    const amountLabel = p.amount != null
                      ? `${isRefund ? '-' : ''}$${Number(p.amount).toFixed(2)}`
                      : 'N/A';
                    return (
                      <li
                        key={p.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 0.5rem',
                          borderBottom: idx < payments.length - 1 ? '1px solid #e5e7eb' : 'none',
                          gap: '1rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ color: '#374151', fontSize: '0.9rem' }}>{dateLabel}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                          {p.type}
                        </span>
                        <span style={{ fontWeight: 600, color: isRefund ? '#b91c1c' : '#111827', fontSize: '0.95rem' }}>
                          {amountLabel}
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
                          {p.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
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

      {/* ── MESSAGES TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'messages' && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Support Messages</h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
            Your correspondence with our support team
          </p>

          {/* New Message button */}
          {!showCompose && (
            <button
              onClick={() => { setShowCompose(true); setComposeError(''); setComposeSuccess(false); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.25rem',
                background: '#0d5d2f',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                marginBottom: '1.25rem',
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Message
            </button>
          )}

          {/* Compose form */}
          {showCompose && (
            <form
              onSubmit={handleComposeSubmit}
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#111827' }}>New Message</h3>
                <button
                  type="button"
                  onClick={() => { setShowCompose(false); setComposeError(''); setComposeSuccess(false); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280',
                    fontSize: '1.25rem',
                    lineHeight: 1,
                    padding: '0.25rem',
                  }}
                  aria-label="Close compose form"
                >
                  &times;
                </button>
              </div>

              {/* Subject dropdown */}
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="composeSubject"
                  style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                >
                  Subject
                </label>
                <select
                  id="composeSubject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                    background: '#fff',
                  }}
                >
                  <option value="Billing question">Billing question</option>
                  <option value="Technical support">Technical support</option>
                  <option value="Privacy">Privacy</option>
                  <option value="Remove my information">Remove my information</option>
                  <option value="General inquiry">General inquiry</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Message textarea */}
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="composeMessage"
                  style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                >
                  Message
                </label>
                <textarea
                  id="composeMessage"
                  value={composeMessage}
                  onChange={(e) => { if (e.target.value.length <= 250) setComposeMessage(e.target.value); }}
                  maxLength={250}
                  rows={4}
                  placeholder="Describe how we can help..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
                <span style={{ display: 'block', textAlign: 'right', fontSize: '0.8rem', color: composeMessage.length >= 240 ? '#dc2626' : '#9ca3af', marginTop: '0.25rem' }}>
                  {composeMessage.length}/250
                </span>
              </div>

              {composeError && (
                <p style={{ color: '#dc2626', background: '#fee2e2', padding: '0.6rem 0.9rem', borderRadius: '0.375rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {composeError}
                </p>
              )}

              {composeSuccess && (
                <p style={{ color: '#166534', background: '#dcfce7', padding: '0.6rem 0.9rem', borderRadius: '0.375rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Message sent successfully!
                </p>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="submit"
                  disabled={composeSending || !composeMessage.trim()}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: composeSending || !composeMessage.trim() ? '#9ca3af' : '#0d5d2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: composeSending || !composeMessage.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {composeSending ? 'Sending...' : 'Send Message'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCompose(false); setComposeError(''); setComposeSuccess(false); }}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: '#fff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {messagesLoading && messages.length === 0 ? (
            <div>
              <Skeleton variant="card" height={80} style={{ marginBottom: '0.75rem' }} />
              <Skeleton variant="card" height={80} style={{ marginBottom: '0.75rem' }} />
              <Skeleton variant="card" height={80} />
            </div>
          ) : messagesError ? (
            <p className={styles.errorText}>{messagesError}</p>
          ) : messages.length === 0 ? (
            <div className={styles.emptyState}>
              <p><strong>Contact our support team below.</strong></p>
              <p style={{ fontSize: '0.9rem', color: '#555', marginTop: '0.5rem' }}>
                Replies from our team are sent to your account email. Use the <strong>New Message</strong> button above to start a conversation.
              </p>
            </div>
          ) : (
            <>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {messages.map((msg, idx) => {
                  const isSupport = msg.type === 'userContactCsrMail';
                  const subject = msg.content?.subject;
                  const messageBody = msg.content?.message || '';
                  const isHtml = msg.content?.contentType === 'text/html';
                  return (
                    <li
                      key={msg._id || idx}
                      style={{
                        padding: '1rem',
                        marginBottom: '0.75rem',
                        background: isSupport ? '#f0fdf4' : '#f9fafb',
                        borderLeft: `4px solid ${isSupport ? '#0d5d2f' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                      }}
                    >
                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {/* Direction icon */}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: isSupport ? '#0d5d2f' : '#6b7280', color: '#fff', fontSize: '0.75rem', flexShrink: 0,
                          }}>
                            {isSupport ? (
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2 4 5v6c0 5 3.5 9.3 8 11 4.5-1.7 8-6 8-11V5l-8-3Z" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="8" r="4" />
                                <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
                              </svg>
                            )}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSupport ? '#0d5d2f' : '#374151' }}>
                            {isSupport ? 'Support Team' : 'You'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                          {formatMessageDate(msg.createdAt)}
                        </span>
                      </div>

                      {/* Subject */}
                      {subject && (
                        <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.95rem', margin: '0 0 0.4rem' }}>
                          {subject}
                        </p>
                      )}

                      {/* Message body */}
                      {isHtml ? (
                        <div
                          style={{ color: '#374151', fontSize: '0.9rem', lineHeight: '1.6', wordBreak: 'break-word' }}
                          dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(messageBody) }}
                        />
                      ) : (
                        <p style={{ color: '#374151', fontSize: '0.9rem', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {messageBody}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>

              {hasMoreMessages ? (
                <button
                  className={styles.loadMoreBtn}
                  onClick={handleLoadMoreMessages}
                  disabled={messagesLoading}
                >
                  {messagesLoading ? 'Loading...' : 'Load More Messages'}
                </button>
              ) : (
                messages.length > 0 && (
                  <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
                    All messages loaded
                  </p>
                )
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
};

export default AccountPage;
