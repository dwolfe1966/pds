import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';

/**
 * Variant A — VCard + free signup form.
 * Shows visible profile summary (name, age, location, record counts)
 * with an inline signup form to unlock the full report.
 * After signup the useSignup hook navigates to /payment.
 *
 * Props: person (object), id (string)
 *
 * IMPORTANT: form inputs are inside the JSX returned directly from this
 * top-level component (not inside a component defined in render), so React
 * never remounts the inputs on re-render.
 */
const SearchDetailPreviewVariantA = ({ person, id }) => {
  const brand = useBrand();
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const { submit: submitSignup, loading, error, setError, success } = useSignup();

  const initials = (person.fullName || '?')
    .split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';

  const handleSubmit = (e) => {
    e.preventDefault();
    submitSignup({ email: signupEmail, password: signupPassword, optin: true, selectedPersonId: id || null });
  };

  return (
    <main className={styles.main} data-no-nav="true">
      {/* ── Mini header ── */}
      <div className={styles.miniHeader}>
        <Link to="/name/search-result" className={styles.miniHeaderBack}>← Back to Results</Link>
        <span className={styles.miniHeaderBrand}>🔒 {brand.name}.ai</span>
      </div>

      {/* ── VCard ── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '0.875rem',
        padding: '1.75rem 1.5rem',
        margin: '1.25rem 1rem 1rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        {/* Avatar + name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #0d5d2f 0%, #1a7a42 100%)',
            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em',
          }}>
            {initials}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              {person.fullName}
            </h1>
            {(person.ageRange || person.location) && (
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.9rem', color: '#6b7280' }}>
                {person.ageRange ? `Age ${person.ageRange}` : ''}
                {person.ageRange && person.location ? ' · ' : ''}
                {person.location || ''}
              </p>
            )}
          </div>
        </div>

        {/* Verified badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7',
          borderRadius: '999px', padding: '0.3rem 0.875rem',
          fontSize: '0.78rem', fontWeight: 600, marginBottom: '1.25rem',
        }}>
          ✓ Profile verified in our database
        </div>

        {/* Record counts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { icon: '📞', label: 'Phone Numbers', count: person._phoneCount || '2–4 found' },
            { icon: '✉️', label: 'Email Addresses', count: person._emailCount || '1–3 found' },
            { icon: '🏠', label: 'Address Records', count: person._addressCount || '3–7 found' },
            { icon: '👥', label: 'Relatives & Associates', count: person._relativeCount || '3–8 found' },
            { icon: '⚠️', label: 'Criminal & Court Records', count: 'Available' },
          ].map(({ icon, label, count }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.5rem',
              fontSize: '0.875rem',
            }}>
              <span style={{ color: '#374151' }}>{icon} {label}</span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a',
                borderRadius: '999px', padding: '0.15rem 0.6rem',
                fontSize: '0.73rem', fontWeight: 600,
              }}>
                🔒 {count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Signup form card ── */}
      <div className={styles.signupFormCard} id="signup-form">
        <div className={styles.signupFormLockIcon} aria-hidden="true">🔓</div>
        <h2 className={styles.signupFormTitle}>
          Create Your Free Account to Unlock
        </h2>
        <p className={styles.signupFormSubtitle}>
          Get instant access to the full report for <strong>{person.fullName}</strong>.
          No credit card required.
        </p>

        {success ? (
          <div className={styles.signupSuccessMsg}>
            ✅ Account created! Redirecting to complete your access…
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="va-email">Email address</label>
              <input
                id="va-email"
                type="email"
                name="email"
                value={signupEmail}
                onChange={e => setSignupEmail(e.target.value)}
                className={styles.signupFormInput}
                placeholder="you@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="va-password">Create a password</label>
              <input
                id="va-password"
                type="password"
                name="password"
                value={signupPassword}
                onChange={e => setSignupPassword(e.target.value)}
                className={styles.signupFormInput}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className={styles.formError}>
                {error === 'already_exists' ? (
                  <>An account with this email already exists. <Link to="/login" className={styles.loginLink}>Log in instead</Link></>
                ) : error}
              </div>
            )}

            <button
              type="submit"
              className={styles.signupSubmitBtn}
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create My Free Account →'}
            </button>
            <p className={styles.noCardNote}>No credit card required to sign up</p>
            <p className={styles.loginLinkWrap}>
              Already have an account?{' '}
              <Link to="/login" className={styles.loginLink}>Sign in</Link>
            </p>
          </form>
        )}

        <div className={styles.trustRow}>
          <span>🔒 SSL Encrypted</span>
          <span>🚫 No spam</span>
        </div>
      </div>

      {/* ── Sticky mobile CTA ── */}
      <div className={styles.stickyMobileCta}>
        <a
          href="#signup-form"
          className={styles.stickyMobileCtaLink}
          onClick={e => { e.preventDefault(); document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' }); }}
        >
          🔓 Unlock Full Report — Create Free Account →
        </a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewVariantA;
