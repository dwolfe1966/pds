import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import { track } from '../../services/trackingService';
import { isValidEmail } from '../../utils/email';
import { getCapturedEmail } from '../../services/emailCapture';
import '../../styles/contentContainer.css';
import styles from './SignupPage.module.css';

/**
 * Sign-up page — collects email + password only.
 * Name is collected on the payment page billing form and passed to BC via userInfo.
 *
 * Uses useSignup hook for shared signup logic (auth state, sessionStorage, navigation).
 * Redirect target is validated against SAFE_REDIRECT_PREFIXES in the hook to prevent
 * open-redirect abuse via crafted ?redirect= query params.
 */
const SignupPage = ({ source = 'direct' }) => {
  const location = useLocation();
  const { submit, loading, error, success, redirectTo } = useSignup();

  const [form, setForm] = useState({ email: '', password: '', phone: '', optin: false });
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [emailError, setEmailError] = useState('');

  // Track page entry
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    track('signup_start', {
      source: params.get('selected') ? 'teaser' : source,
      has_selected: !!params.get('selected'),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill the email captured earlier in the funnel (e.g. the BV mid-loader gate),
  // so a visitor doesn't re-type it here. ?email= param wins; else the captured email.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pre = params.get('email') || getCapturedEmail();
    if (pre) setForm(f => (f.email ? f : { ...f, email: pre }));
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // Live password requirement — bug #28 (2026-05-29): dropped to 8-char min
  // only. Uppercase/number/special churn caused 3-click signup friction with
  // no real security benefit for this product.
  const passwordChecks = [
    { label: 'At least 8 characters', ok: form.password.length >= 8 },
  ];
  const passwordTouched = form.password.length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setEmailError('');
    // Bug #52 (2026-05-29): block submit on obvious garbage (no @, no TLD).
    // HTML5 type=email is too lenient; this catches the original repro
    // `testingreg052826c` before we burn a BC round-trip.
    if (!isValidEmail(form.email)) {
      setEmailError('Please enter a valid email address (e.g., name@example.com).');
      track('validation_error', { reason: 'invalid_email', step: 'signup' });
      return;
    }
    const params = new URLSearchParams(location.search);
    submit({
      email: form.email,
      password: form.password,
      optin: form.optin,
      selectedPersonId: params.get('selected'),
      queryString: location.search.replace(/^\?/, '') || undefined,
      redirectParam: params.get('redirect'),
      extraPayload: { phone: form.phone.trim() || undefined },
    });
  };

  return (
    <main className="pageBackground">
      <div className={styles.container}>
        <div className={styles.card}>

          {/* Compact person banner — shown at top, doesn't push form down */}
          {selectedPerson && !success && (
            <div className={styles.personBanner}>
              <span className={styles.personBannerLock}>🔓</span>
              <span className={styles.personBannerText}>
                Create an account to unlock <strong>{selectedPerson.fullName}</strong>'s full report
              </span>
            </div>
          )}

          <h1 className={styles.title}>Create Your Account</h1>

          {!selectedPerson && !success && (
            <p className={styles.subtitle}>
              Unlock full access to detailed reports.
            </p>
          )}

          {success ? (
            <div className={styles.successMsg}>
              <h2>Account Created!</h2>
              <p>
                {redirectTo === '/dashboard'
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
                  onChange={(e) => { setEmailError(''); handleChange(e); }}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className={styles.input}
                  style={emailError ? { borderColor: '#dc2626' } : undefined}
                />
                {emailError && (
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: '#dc2626' }}>
                    {emailError}
                  </p>
                )}
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#4b5563', lineHeight: 1.45 }}>
                  We'll only use your email for login, receipts, and account alerts.
                  Never sold, shared, or used for marketing without your consent.
                </p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="phone">
                  Phone <span style={{ fontWeight: 400, color: '#6b7280' }}>(optional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  autoComplete="tel"
                  placeholder="(555) 123-4567"
                  className={styles.input}
                />
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#4b5563', lineHeight: 1.45 }}>
                  Optional — helps with account security and faster support. We'll only text you if you opt in.
                </p>
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
                <ul style={{
                  listStyle: 'none', padding: 0, margin: '0.4rem 0 0',
                  fontSize: '0.78rem', lineHeight: 1.6,
                }}>
                  {passwordChecks.map((c) => (
                    <li
                      key={c.label}
                      style={{
                        color: c.ok ? '#047857' : (passwordTouched ? '#b91c1c' : '#6b7280'),
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                      }}
                    >
                      <span aria-hidden="true" style={{
                        display: 'inline-block', width: '0.9em', textAlign: 'center',
                      }}>{c.ok ? '✓' : '○'}</span>
                      {c.label}
                    </li>
                  ))}
                </ul>
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
                    <p>An account with this email already exists. <Link to="/login" style={{ color: '#0d5d2f', fontWeight: 600 }}>Log in instead</Link></p>
                  ) : (
                    <><p><strong>Error:</strong></p><p>{error}</p></>
                  )}
                </div>
              )}
              <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? 'Creating account…' : 'Create My Account'}
              </button>
              <p className={styles.loginLink}>
                Already have an account? <Link to="/login">Log in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
};

export default SignupPage;
