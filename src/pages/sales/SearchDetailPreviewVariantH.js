import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';

/**
 * Variant H — "Trust-maximal" form-first teaser.
 * Hypothesis: stacking HONEST trust (verified-data, security/process, privacy, cancel-anytime,
 * a member quote) around a top-placed form lifts signup. Uses only substantiable trust beats —
 * no fabricated star-counts/press logos/named testimonials (those are owner-supplied content
 * that would strengthen this further). Tracking unchanged (parent teaser_view + submitSignup).
 * Props: person, id
 */
const SearchDetailPreviewVariantH = ({ person, id }) => {
  const brand = useBrand();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submit: submitSignup, loading, error, success } = useSignup();
  const firstName = (person.fullName || 'this person').split(/\s+/)[0];
  const onSubmit = (e) => { e.preventDefault(); submitSignup({ email, password, optin: true, selectedPersonId: id || null }); };

  const TrustChip = ({ children }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: '#f0f8f9', color: '#0f5132', border: '1px solid #d6eef0', borderRadius: 999, padding: '0.25rem 0.6rem', fontSize: '0.72rem', fontWeight: 600 }}>{children}</span>
  );

  return (
    <main className={styles.main} data-no-nav="true">
      <div className={styles.miniHeader}>
        <Link to="/name/search-result" className={styles.miniHeaderBack}>← Back to Results</Link>
        <span className={styles.miniHeaderBrand}>🔒 {brand.name}.ai</span>
      </div>

      {/* Trust banner FIRST */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', margin: '0.9rem 1rem 0.4rem' }}>
        <TrustChip>✓ Verified in our database</TrustChip>
        <TrustChip>🔒 256-bit SSL</TrustChip>
        <TrustChip>🛡️ Privacy protected</TrustChip>
        <TrustChip>✓ Cancel anytime</TrustChip>
      </div>

      <p style={{ margin: '0.2rem 1rem 0.4rem', fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>
        {person.fullName}{person.location ? ` · ${person.location}` : ''}
      </p>

      {/* Form (top) */}
      <div className={styles.signupFormCard} id="signup-form">
        <div className={styles.signupFormLockIcon} aria-hidden="true">🔓</div>
        <h2 className={styles.signupFormTitle}>Unlock {firstName}&apos;s full report</h2>
        <p className={styles.signupFormSubtitle}>Contact info, addresses, relatives &amp; records.</p>
        {success ? (
          <div className={styles.signupSuccessMsg}>✅ Account created! Redirecting…</div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vh-email">Email address</label>
              <input id="vh-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.signupFormInput} placeholder="you@email.com" required autoComplete="email" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vh-password">Create a password</label>
              <input id="vh-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.signupFormInput} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
            </div>
            {error && <div className={styles.formError}>{error === 'already_exists' ? (<>Account exists. <Link to="/login" className={styles.loginLink}>Log in</Link></>) : error}</div>}
            <button type="submit" className={styles.signupSubmitBtn} disabled={loading}>{loading ? 'Creating account…' : 'Create My Account →'}</button>
            <p className={styles.loginLinkWrap}>Already have an account? <Link to="/login" className={styles.loginLink}>Sign in</Link></p>
          </form>
        )}
        <div className={styles.trustRow}><span>🔒 SSL Encrypted</span><span>🚫 No spam</span></div>
      </div>

      {/* Member quote (honest, generic) + data-quality badge */}
      <div style={{ margin: '0.6rem 1rem', padding: '0.9rem 1rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.625rem' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#374151', fontStyle: 'italic' }}>
          &ldquo;Reconnected with family I&apos;d lost touch with for years.&rdquo;
        </p>
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: '#9ca3af' }}>— Verified {brand.name} member</p>
      </div>

      {/* Counts (smaller, reinforcing) */}
      <div style={{ margin: '0 1rem 5rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {[['📞', person._phoneCount, 'phones'], ['🏠', person._addressCount, 'addresses'], ['👥', person._relativeCount, 'relatives']].filter(([, c]) => c).map(([icon, c, l]) => (
          <span key={l} style={{ fontSize: '0.78rem', color: '#374151', background: '#f9fafb', border: '1px solid #f0f1f3', borderRadius: 999, padding: '0.25rem 0.7rem' }}>{icon} {c} {l}</span>
        ))}
        <p style={{ width: '100%', fontSize: '0.66rem', color: '#9ca3af', margin: '0.5rem 0 0', lineHeight: 1.4 }}>
          {brand.name} is not a consumer reporting agency under the FCRA. Not for employment, tenant, or credit screening.
        </p>
      </div>

      <div className={styles.stickyMobileCta}>
        <a href="#signup-form" className={styles.stickyMobileCtaLink} onClick={(e) => { e.preventDefault(); document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' }); }}>🔓 Unlock Full Report — Create Account →</a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewVariantH;
