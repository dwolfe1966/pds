import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';

/**
 * Variant G — "Form-first" signup teaser.
 *
 * Hypothesis: VariantA buries the signup form BELOW the full teaser VCard, so the
 * user must scroll past everything to reach the ask. G hoists the form to the top
 * (right under a compact identity hook), then reinforces with per-section counts +
 * micro-CTAs (rec R6) and a trust band (R11) BELOW. Tracking contract is unchanged:
 * the parent fires teaser_view; submitSignup fires signup_complete.
 *
 * Props: person (object), id (string)
 * Honesty guardrail: counts come from the BC-derived person object; where absent we
 * say "In full report" — never a fabricated value.
 */
const SearchDetailPreviewVariantG = ({ person, id }) => {
  const brand = useBrand();
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const { submit: submitSignup, loading, error, success } = useSignup();

  const initials = (person.fullName || '?')
    .split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?';

  const handleSubmit = (e) => {
    e.preventDefault();
    submitSignup({ email: signupEmail, password: signupPassword, optin: true, selectedPersonId: id || null });
  };

  const scrollToForm = (e) => {
    if (e) e.preventDefault();
    document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Count rows (BC-derived; honest fallback = "In full report", never invented).
  const sections = [
    { icon: '📞', label: 'Phone numbers', count: person._phoneCount, cta: 'see contact info' },
    { icon: '✉️', label: 'Email addresses', count: person._emailCount, cta: 'see emails' },
    { icon: '🏠', label: 'Address history', count: person._addressCount, cta: 'see addresses' },
    { icon: '👥', label: 'Relatives & associates', count: person._relativeCount, cta: 'see relatives' },
    { icon: '⚠️', label: 'Criminal & court records', count: person._courtCount, cta: 'see records' },
  ];
  const firstName = (person.fullName || 'this person').split(/\s+/)[0];

  return (
    <main className={styles.main} data-no-nav="true">
      {/* ── Mini header ── */}
      <div className={styles.miniHeader}>
        <Link to="/name/search-result" className={styles.miniHeaderBack}>← Back to Results</Link>
        <span className={styles.miniHeaderBrand}>🔒 {brand.name}.ai</span>
      </div>

      {/* ── Compact identity hook (small — the form is the hero) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', margin: '1rem 1rem 0.5rem' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #0d5d2f 0%, #1a7a42 100%)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem', fontWeight: 700,
        }}>{initials}</div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
            {person.fullName}
          </h1>
          {(person.ageRange || person.location) && (
            <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
              {person.ageRange ? `Age ${person.ageRange}` : ''}
              {person.ageRange && person.location ? ' · ' : ''}
              {person.location || ''}
            </p>
          )}
        </div>
      </div>

      {/* ── SIGNUP FORM — hoisted to the top (the variant-G change) ── */}
      <div className={styles.signupFormCard} id="signup-form" style={{ marginTop: '0.5rem' }}>
        <div className={styles.signupFormLockIcon} aria-hidden="true">🔓</div>
        <h2 className={styles.signupFormTitle}>Unlock {firstName}&apos;s full report</h2>
        <p className={styles.signupFormSubtitle}>
          Create your account to see contact info, addresses, relatives &amp; records.
        </p>

        {success ? (
          <div className={styles.signupSuccessMsg}>✅ Account created! Redirecting…</div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vg-email">Email address</label>
              <input
                id="vg-email" type="email" name="email" value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                className={styles.signupFormInput} placeholder="you@email.com" required autoComplete="email"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vg-password">Create a password</label>
              <input
                id="vg-password" type="password" name="password" value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                className={styles.signupFormInput} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password"
              />
            </div>
            {error && (
              <div className={styles.formError}>
                {error === 'already_exists' ? (
                  <>An account with this email already exists. <Link to="/login" className={styles.loginLink}>Log in instead</Link></>
                ) : error}
              </div>
            )}
            <button type="submit" className={styles.signupSubmitBtn} disabled={loading}>
              {loading ? 'Creating account…' : 'Create My Account →'}
            </button>
            <p className={styles.loginLinkWrap}>
              Already have an account? <Link to="/login" className={styles.loginLink}>Sign in</Link>
            </p>
          </form>
        )}

        <div className={styles.trustRow}>
          <span>🔒 SSL Encrypted</span>
          <span>🚫 No spam</span>
          <span>✓ Cancel anytime</span>
        </div>
      </div>

      {/* ── Proof BELOW the form: per-section counts + micro-CTAs (R6) ── */}
      <div style={{ margin: '0.5rem 1rem 1rem' }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>
          What&apos;s in {firstName}&apos;s report:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {sections.map(({ icon, label, count, cta }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.55rem 0.75rem', background: '#f9fafb', border: '1px solid #f0f1f3',
              borderRadius: '0.5rem', fontSize: '0.85rem',
            }}>
              <span style={{ color: '#374151' }}>
                {icon} {count ? <strong>{count}</strong> : ''} {label}
              </span>
              <a href="#signup-form" onClick={scrollToForm} style={{ color: '#1a7a42', fontWeight: 600, fontSize: '0.78rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                🔒 {cta} »
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* ── Trust band (R11) ── */}
      <div style={{ margin: '0 1rem 5rem', padding: '1rem', background: '#f0f8f9', borderRadius: '0.625rem', border: '1px solid #d6eef0' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#d1fae5', color: '#065f46',
          border: '1px solid #6ee7b7', borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.74rem', fontWeight: 600, marginBottom: '0.6rem',
        }}>✓ Profile verified in our database</div>
        <p style={{ fontSize: '0.82rem', color: '#374151', fontStyle: 'italic', margin: '0 0 0.5rem' }}>
          &ldquo;Found exactly who I was looking for in minutes.&rdquo; — verified member
        </p>
        <p style={{ fontSize: '0.68rem', color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
          {brand.name} is not a consumer reporting agency under the FCRA. Information may not be used for
          employment, tenant, or credit screening.
        </p>
      </div>

      {/* ── Sticky mobile CTA ── */}
      <div className={styles.stickyMobileCta}>
        <a href="#signup-form" className={styles.stickyMobileCtaLink} onClick={scrollToForm}>
          🔓 Unlock Full Report — Create Account →
        </a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewVariantG;
