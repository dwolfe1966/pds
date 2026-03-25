import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { track } from '../../services/trackingService';
import '../../styles/contentContainer.css';
import styles from './SignupPage.module.css';

/**
 * Sign-up page — collects email + password only.
 * Name is collected on the payment page billing form and passed to BC via userInfo.
 */
const SignupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, setUser } = useAuth();

  const [form, setForm] = useState({ email: '', password: '', optin: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successRedirectTo, setSuccessRedirectTo] = useState('/dashboard');
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Track page entry
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    track('signup_start', {
      source: params.get('selected') ? 'teaser' : 'direct',
      has_selected: !!params.get('selected'),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load selected person from sessionStorage (synchronous — no async state churn)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const selectedPersonId = params.get('selected');
    if (!selectedPersonId) return;
    const stored = sessionStorage.getItem(`result_${selectedPersonId}`);
    if (stored) {
      try { setSelectedPerson(JSON.parse(stored)); } catch { /* ignore */ }
      return;
    }
    const personName = params.get('personName');
    if (personName) {
      setSelectedPerson({
        fullName: personName,
        location: params.get('personLocation') || '',
        ageRange: params.get('personAge') || '',
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams(location.search);
      const response = await api.signup({
        email: form.email,
        password: form.password,
        optin: !!form.optin,
        queryString: window.location.search.replace(/^\?/, '') || undefined,
      });

      if (response.accessToken) {
        const userData = response.user || {
          email: form.email,
          role: 'member',
          emailVerified: false,
        };
        setToken(response.accessToken);
        setUser(userData);
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('user', JSON.stringify(userData));
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
      }

      // Stash password so PaymentPage can call changePassword after billing.sale
      sessionStorage.setItem('_pendingPw', form.password);

      const selectedPersonId = params.get('selected');
      if (selectedPersonId) {
        sessionStorage.setItem('selectedPersonId', selectedPersonId);
      }

      const redirectTo = params.get('redirect') || (selectedPersonId ? '/payment' : '/dashboard');
      const normalizedRedirect = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`;
      setSuccessRedirectTo(normalizedRedirect);
      track('signup_complete', { source: 'signup_page' });
      setSuccess(true);

      setTimeout(() => navigate(normalizedRedirect), 2000);
    } catch (err) {
      if (err.code === 'USER_ALREADY_EXISTS') {
        setError('already_exists');
      } else {
        setError(err.message || 'An error occurred during signup. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [form, location.search, navigate, setToken, setUser]);

  return (
    <main className="pageBackground">
      <div className={styles.container}>
        <div className={styles.card}>

          {/* Compact person banner — shown at top, doesn't push form down */}
          {selectedPerson && !success && (
            <div className={styles.personBanner}>
              <span className={styles.personBannerLock}>🔓</span>
              <span className={styles.personBannerText}>
                Create a free account to unlock <strong>{selectedPerson.fullName}</strong>'s full report
              </span>
            </div>
          )}

          <h1 className={styles.title}>Create Your Free Account</h1>

          {!selectedPerson && !success && (
            <p className={styles.subtitle}>
              Unlock full access to detailed reports.
              <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                No credit card required.
              </span>
            </p>
          )}

          {success ? (
            <div className={styles.successMsg}>
              <h2>Account Created!</h2>
              <p>
                {successRedirectTo === '/dashboard'
                  ? 'Redirecting to your dashboard…'
                  : 'Redirecting to complete your purchase…'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="password">Password *</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={styles.input}
                />
              </div>
              <label className={styles.optinRow}>
                <input
                  type="checkbox"
                  name="optin"
                  checked={form.optin}
                  onChange={handleChange}
                />
                <span>I agree to receive marketing communications</span>
              </label>
              {error && (
                <div className={styles.errorMsg}>
                  {error === 'already_exists' ? (
                    <p>An account with this email already exists. <a href="/login" style={{ color: '#0d5d2f', fontWeight: 600 }}>Log in instead</a></p>
                  ) : (
                    <><p><strong>Error:</strong></p><p>{error}</p></>
                  )}
                </div>
              )}
              <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? 'Creating account…' : 'Create My Free Account'}
              </button>
              <p className={styles.loginLink}>
                Already have an account? <a href="/login">Log in</a>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
};

export default SignupPage;
