import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import styles from './SignupPageStepped.module.css';

/**
 * Multi-step signup variant — A/B testable at /signup/v2
 *
 * Step 1 — Intent + Email    (low-commitment entry: why are you here + email only)
 * Step 2 — Password          (single focused task)
 * Step 3 — Profile           (name + ZIP — personalization after commitment)
 * Step 4 — Consent + Submit  (marketing opt-in with trust copy)
 *
 * IMPORTANT: Calls api.billingSignup() on final submit to persist the user
 * in the ByteCrtrs system (required for payment/billing to work downstream).
 */

const TOTAL_STEPS = 4;

const INTENT_OPTIONS = [
  { value: 'find_someone',  label: 'Finding someone',           icon: '🔍' },
  { value: 'my_record',     label: 'Checking my own record',    icon: '🪪' },
  { value: 'safety_check',  label: 'Running a safety check',    icon: '🛡️' },
  { value: 'reconnect',     label: 'Reconnecting with someone', icon: '🤝' },
  { value: 'other',         label: 'Something else',            icon: '💬' },
];

const TRUST_COPY = [
  '🔒 256-bit SSL encryption',
  '📋 12B+ public records',
  '✓ FCRA compliant',
  '🚫 No spam, ever',
];

const SignupPageStepped = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, setUser } = useAuth();

  // Multi-step form state
  const [step, setStep] = useState(1);
  const [intent, setIntent] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [zip, setZip] = useState('');
  const [optin, setOptin] = useState(true);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successRedirectTo, setSuccessRedirectTo] = useState('/dashboard');
  const [selectedPerson, setSelectedPerson] = useState(null);

  // Load selected person teaser from sessionStorage (same as SignupPage)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const selectedPersonId = params.get('selected');
    if (!selectedPersonId) return;
    const stored = sessionStorage.getItem(`result_${selectedPersonId}`);
    if (stored) {
      try { setSelectedPerson(JSON.parse(stored)); } catch { /* ignore */ }
    } else {
      const personName = params.get('personName');
      if (personName) {
        setSelectedPerson({
          fullName: personName,
          location: params.get('personLocation') || '',
          ageRange: params.get('personAge') || '',
        });
      }
    }
  }, [location.search]);

  // ── Step navigation helpers ──────────────────────────────────────────────

  const progressPct = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  const goNext = () => {
    setError('');
    setStep((s) => s + 1);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    setError('');
    setStep((s) => s - 1);
    window.scrollTo(0, 0);
  };

  // ── Step validators ──────────────────────────────────────────────────────

  const handleStep1 = (e) => {
    e.preventDefault();
    if (!intent) { setError('Please select what brings you here.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setError('Please enter a valid email address.'); return; }
    goNext();
  };

  const handleStep2 = (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    goNext();
  };

  const handleStep3 = (e) => {
    e.preventDefault();
    if (!fullName.trim()) { setError('Please enter your full name.'); return; }
    goNext();
  };

  // ── Final submit ─────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Run mock signup (JWT) and ByteCrtrs billingSignup in parallel.
      // billingSignup persists the user in ByteCrtrs so billing.sale works on the payment page.
      const [response] = await Promise.all([
        api.signup({
          fullName: fullName.trim(),
          zip: zip.trim(),
          email: email.trim(),
          password,
          optin: !!optin,
          intent,
        }),
        api.billingSignup({
          userInfo: { email: email.trim(), firstName, lastName, optin: !!optin },
          ...(window.location.search && { queryString: window.location.search.replace(/^\?/, '') }),
        }).catch((err) => {
          // Non-fatal — ByteCrtrs registration failure should not block signup
          if (process.env.NODE_ENV === 'development') {
            console.warn('[SignupStepped] billingSignup failed (non-fatal):', err?.message);
          }
        }),
      ]);

      if (response.accessToken) {
        const userData = response.user || {
          id: response.user?.id || response.user?._id || response.userId || null,
          email: email.trim(),
          fullName: fullName.trim(),
          optin,
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

      // Store selected person ID in sessionStorage for payment page
      const params = new URLSearchParams(location.search);
      const selectedPersonId = params.get('selected');
      if (selectedPersonId) sessionStorage.setItem('selectedPersonId', selectedPersonId);

      // Determine redirect
      const redirectTo = params.get('redirect') || (selectedPersonId ? '/payment' : '/dashboard');
      const normalizedRedirect = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`;
      setSuccessRedirectTo(normalizedRedirect);
      setSuccess(true);

      setTimeout(() => navigate(normalizedRedirect), 2000);
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'An error occurred during signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main className={styles.main}>
      <div className={styles.container}>

        {/* Teaser banner when coming from a search result */}
        {selectedPerson && !success && (
          <div className={styles.teaserBanner}>
            <span className={styles.teaserIcon}>🔓</span>
            <div>
              <strong>Unlock full report for {selectedPerson.fullName}</strong>
              {selectedPerson.location && (
                <span className={styles.teaserMeta}> · {selectedPerson.location}</span>
              )}
            </div>
          </div>
        )}

        <div className={styles.card}>

          {success ? (
            <div className={styles.successBox}>
              <div className={styles.successIcon}>✓</div>
              <h2 className={styles.successTitle}>You're in!</h2>
              <p className={styles.successText}>
                Account created.{' '}
                {successRedirectTo === '/dashboard'
                  ? 'Taking you to your dashboard…'
                  : 'Taking you to complete your purchase…'}
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className={styles.header}>
                <h1 className={styles.title}>
                  {step === 1 && 'Why are you searching today?'}
                  {step === 2 && 'Create your password'}
                  {step === 3 && 'A little about you'}
                  {step === 4 && 'Almost done!'}
                </h1>
                <p className={styles.stepLabel}>Step {step} of {TOTAL_STEPS}</p>
              </div>

              {/* Progress bar */}
              <div className={styles.progressTrack}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* ── Step 1: Intent + Email ── */}
              {step === 1 && (
                <form onSubmit={handleStep1} className={styles.form}>
                  <p className={styles.helperText}>
                    Choose what describes your search — this helps us show you the most relevant results.
                  </p>

                  <div className={styles.intentGrid}>
                    {INTENT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setIntent(opt.value); setError(''); }}
                        className={`${styles.intentBtn} ${intent === opt.value ? styles.intentBtnActive : ''}`}
                      >
                        <span className={styles.intentIcon}>{opt.icon}</span>
                        <span className={styles.intentLabel}>{opt.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="ss-email">Email address *</label>
                    <input
                      id="ss-email"
                      type="email"
                      className={styles.input}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                    />
                  </div>

                  {error && <p className={styles.errorText}>{error}</p>}

                  <button type="submit" className={styles.primaryBtn}>
                    Continue →
                  </button>

                  <p className={styles.loginHint}>
                    Already have an account? <a href="/login">Sign in</a>
                  </p>
                </form>
              )}

              {/* ── Step 2: Password ── */}
              {step === 2 && (
                <form onSubmit={handleStep2} className={styles.form}>
                  <p className={styles.helperText}>
                    Choose a strong password. You'll use it to log in and view your reports.
                  </p>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="ss-password">Password *</label>
                    <div className={styles.passwordRow}>
                      <input
                        id="ss-password"
                        type={showPassword ? 'text' : 'password'}
                        className={styles.input}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className={styles.showHideBtn}
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? '🙈' : '👁️'}
                      </button>
                    </div>

                    {/* Strength meter */}
                    <div className={styles.strengthRow}>
                      {[1, 2, 3, 4].map((n) => (
                        <div
                          key={n}
                          className={styles.strengthBar}
                          style={{
                            background:
                              password.length === 0 ? '#e5e7eb'
                              : password.length < 6 && n <= 1 ? '#ef4444'
                              : password.length < 8 && n <= 2 ? '#f59e0b'
                              : password.length < 12 && n <= 3 ? '#22c55e'
                              : password.length >= 12 && n <= 4 ? '#16a34a'
                              : '#e5e7eb',
                          }}
                        />
                      ))}
                      <span className={styles.strengthLabel}>
                        {password.length === 0 ? ''
                          : password.length < 6 ? 'Too short'
                          : password.length < 8 ? 'Weak'
                          : password.length < 12 ? 'Good'
                          : 'Strong'}
                      </span>
                    </div>

                    <p className={styles.fieldHint}>Minimum 8 characters</p>
                  </div>

                  {error && <p className={styles.errorText}>{error}</p>}

                  <div className={styles.buttonRow}>
                    <button type="button" className={styles.backBtn} onClick={goBack}>← Back</button>
                    <button type="submit" className={styles.primaryBtn}>Continue →</button>
                  </div>
                </form>
              )}

              {/* ── Step 3: Profile ── */}
              {step === 3 && (
                <form onSubmit={handleStep3} className={styles.form}>
                  <p className={styles.helperText}>
                    We use your name and ZIP to personalize your results and help verify your identity.
                  </p>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="ss-fullName">Full name *</label>
                    <input
                      id="ss-fullName"
                      type="text"
                      className={styles.input}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="First and last name"
                      required
                      autoComplete="name"
                    />
                  </div>

                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="ss-zip">ZIP code <span className={styles.optional}>(optional)</span></label>
                    <input
                      id="ss-zip"
                      type="text"
                      className={styles.input}
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder="e.g. 90210"
                      maxLength={10}
                      inputMode="numeric"
                    />
                  </div>

                  {error && <p className={styles.errorText}>{error}</p>}

                  <div className={styles.buttonRow}>
                    <button type="button" className={styles.backBtn} onClick={goBack}>← Back</button>
                    <button type="submit" className={styles.primaryBtn}>Continue →</button>
                  </div>
                </form>
              )}

              {/* ── Step 4: Consent + Submit ── */}
              {step === 4 && (
                <form onSubmit={handleSubmit} className={styles.form}>
                  {/* Account summary */}
                  <div className={styles.summaryBox}>
                    <p className={styles.summaryRow}>
                      <span className={styles.summaryKey}>Email</span>
                      <span className={styles.summaryVal}>{email}</span>
                    </p>
                    <p className={styles.summaryRow}>
                      <span className={styles.summaryKey}>Name</span>
                      <span className={styles.summaryVal}>{fullName || '—'}</span>
                    </p>
                    {zip && (
                      <p className={styles.summaryRow}>
                        <span className={styles.summaryKey}>ZIP</span>
                        <span className={styles.summaryVal}>{zip}</span>
                      </p>
                    )}
                  </div>

                  <label className={styles.optinRow}>
                    <input
                      type="checkbox"
                      checked={optin}
                      onChange={(e) => setOptin(e.target.checked)}
                    />
                    <span>
                      Send me tips, alerts, and updates about my searches. You can unsubscribe any time.
                    </span>
                  </label>

                  {/* Trust copy */}
                  <div className={styles.trustGrid}>
                    {TRUST_COPY.map((t, i) => (
                      <span key={i} className={styles.trustItem}>{t}</span>
                    ))}
                  </div>

                  <p className={styles.termsText}>
                    By creating an account you agree to our{' '}
                    <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a>{' '}
                    and{' '}
                    <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
                    Reports are not for employment, insurance, or tenant screening (FCRA).
                  </p>

                  {error && <p className={styles.errorText}>{error}</p>}

                  <div className={styles.buttonRow}>
                    <button type="button" className={styles.backBtn} onClick={goBack}>← Back</button>
                    <button type="submit" disabled={loading} className={styles.submitBtn}>
                      {loading ? 'Creating account…' : 'Create My Account'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Trust badges below the card */}
        {!success && (
          <div className={styles.footerTrust}>
            {TRUST_COPY.map((t, i) => (
              <span key={i} className={styles.footerTrustItem}>{t}</span>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default SignupPageStepped;
