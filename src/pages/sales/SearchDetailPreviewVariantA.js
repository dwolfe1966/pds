import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';
import { useCampaign } from '../../context/CampaignContext';

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
  const campaign = useCampaign();
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const { submit: submitSignup, loading, error, setError, success } = useSignup();

  const initials = (person.fullName || '?')
    .split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';

  const handleSubmit = (e) => {
    e.preventDefault();
    submitSignup({ email: signupEmail, password: signupPassword, optin: true, selectedPersonId: id || null });
  };

  // Light-on-green copy under the form fields / CTA (the form card is dark green).
  const microcopy = { margin: '0.35rem 0 0', fontSize: '0.75rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.72)' };
  const trialLine = { margin: '0.9rem 0 0', fontSize: '0.82rem', fontWeight: 600, color: 'rgba(255,255,255,0.95)', textAlign: 'center', lineHeight: 1.4 };
  const satisfactionLine = { margin: '0.5rem 0 0', fontSize: '0.74rem', fontStyle: 'italic', color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 1.45 };

  return (
    <main className={styles.main} data-no-nav="true">
      {/* ── Mini header ── */}
      <div className={styles.miniHeader}>
        <Link to="/name/search-result" className={styles.miniHeaderBack}>← Back to Results</Link>
        <span className={styles.miniHeaderBrand}>🔒 {brand.name}</span>
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
              {person.fullName}{person.ageRange ? `, Age ${person.ageRange}` : ''}
            </h1>
            {Array.isArray(person.aliases) && person.aliases.length > 0 && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', fontStyle: 'italic', color: '#6b7280' }}>
                AKA {person.aliases.slice(0, 3).join(', ')}
              </p>
            )}
            {person.location && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#6b7280' }}>
                {person.location}
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

        {/* What's in the report — honest availability, no fabricated counts.
            (Real per-category counts need a BC teaser ask; today the teaser
            doesn't return them, so we show availability, not invented numbers.) */}
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          What&apos;s in the full report
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { icon: '📞', label: 'Phone Numbers' },
            { icon: '✉️', label: 'Email Addresses' },
            { icon: '🏠', label: 'Address History' },
            { icon: '👥', label: 'Relatives & Associates' },
            { icon: '⚠️', label: 'Criminal & Court Records' },
          ].map(({ icon, label }) => (
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
                🔒 Available
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Signup form card ── */}
      <div className={styles.signupFormCard} id="signup-form">
        <div className={styles.signupFormLockIcon} aria-hidden="true">🔓</div>
        <h2 className={styles.signupFormTitle}>
          Unlock {person.fullName}&apos;s Report
        </h2>

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
              <p style={microcopy}>So we can email your report to you.</p>
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
              <p style={microcopy}>Keeps your report private and secure.</p>
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
              {loading ? 'Unlocking…' : 'Unlock Report →'}
            </button>

            {/* Value + reassurance under the CTA */}
            <p style={trialLine}>
              Your trial membership includes full access to name, phone, and email searches.
            </p>
            <p style={satisfactionLine}>
              Your satisfaction is important to us. If you&apos;re not fully satisfied, call our
              customer care team at <a href="tel:8662041902" style={{ color: '#fff', fontWeight: 600 }}>866-204-1902</a>.
            </p>

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
          🔓 Unlock Report →
        </a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewVariantA;
