import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';

/**
 * Variant I — "Email-first soft gate" (rec R8).
 * Hypothesis: a single low-commitment email field (password deferred via progressive
 * disclosure) lowers the activation barrier vs. asking for email+password up front.
 * HONESTY: the account is free; the report unlock is the $1 trial at /payment — copy says
 * "free account," never "free report." Tracking unchanged (parent teaser_view + submitSignup).
 * Props: person, id
 */
const SearchDetailPreviewVariantI = ({ person, id }) => {
  const brand = useBrand();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState(1); // 1 = email only, 2 = password revealed
  const { submit: submitSignup, loading, error, success } = useSignup();
  const firstName = (person.fullName || 'this person').split(/\s+/)[0];

  const onSubmit = (e) => {
    e.preventDefault();
    if (stage === 1) { if (email.includes('@')) setStage(2); return; }
    submitSignup({ email, password, optin: true, selectedPersonId: id || null });
  };

  return (
    <main className={styles.main} data-no-nav="true" style={{ background: '#fff5f6', minHeight: '100vh' }}>
      <div className={styles.miniHeader}>
        <Link to="/name/search-result" className={styles.miniHeaderBack}>← Back to Results</Link>
        <span className={styles.miniHeaderBrand}>🔒 {brand.name}.ai</span>
      </div>

      <div style={{ margin: '1rem 1rem 0.4rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#111827' }}>{person.fullName}</h1>
        {(person.ageRange || person.location) && (
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
            {person.ageRange ? `Age ${person.ageRange}` : ''}{person.ageRange && person.location ? ' · ' : ''}{person.location || ''}
          </p>
        )}
      </div>

      {/* Email-first form (top) */}
      <div className={styles.signupFormCard} id="signup-form" style={{ background: 'linear-gradient(160deg,#9f1239,#4c0519)', borderTop: '4px solid #fda4af' }}>
        <div className={styles.signupFormLockIcon} aria-hidden="true">🔓</div>
        <h2 className={styles.signupFormTitle} style={{ color: '#ffffff' }}>See {firstName}&apos;s report</h2>
        <p className={styles.signupFormSubtitle}>Enter your email to create your free account and continue.</p>
        {success ? (
          <div className={styles.signupSuccessMsg}>✅ Account created! Redirecting…</div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vi-email">Email address</label>
              <input id="vi-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.signupFormInput} placeholder="you@email.com" required autoComplete="email" autoFocus />
            </div>
            {stage === 2 && (
              <div className={styles.formGroup}>
                <label className={styles.signupFormLabel} htmlFor="vi-password">Create a password</label>
                <input id="vi-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.signupFormInput} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" autoFocus />
              </div>
            )}
            {error && <div className={styles.formError}>{error === 'already_exists' ? (<>Account exists. <Link to="/login" className={styles.loginLink}>Log in</Link></>) : error}</div>}
            <button type="submit" className={styles.signupSubmitBtn} disabled={loading} style={{ background: '#f43f5e' }}>
              {loading ? 'Creating account…' : (stage === 1 ? 'Continue →' : 'Create My Account →')}
            </button>
            <p className={styles.loginLinkWrap}>Already have an account? <Link to="/login" className={styles.loginLink}>Sign in</Link></p>
          </form>
        )}
        <div className={styles.trustRow}><span>🔒 SSL Encrypted</span><span>🚫 No spam</span><span>✓ Free account</span></div>
      </div>

      {/* Light proof below */}
      <div style={{ margin: '0.5rem 1rem 5rem' }}>
        <p style={{ fontSize: '0.82rem', color: '#374151', margin: '0 0 0.4rem' }}>Your free account unlocks:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {[['📞', person._phoneCount, 'phone numbers'], ['🏠', person._addressCount, 'addresses'], ['👥', person._relativeCount, 'relatives'], ['⚠️', null, 'court records']].map(([icon, c, l]) => (
            <span key={l} style={{ fontSize: '0.78rem', color: '#374151', background: '#f9fafb', border: '1px solid #f0f1f3', borderRadius: 999, padding: '0.25rem 0.7rem' }}>{icon} {c ? <strong>{c} </strong> : ''}{l}</span>
          ))}
        </div>
        <p style={{ fontSize: '0.66rem', color: '#9ca3af', margin: '0.6rem 0 0', lineHeight: 1.4 }}>
          {brand.name} is not a consumer reporting agency under the FCRA. Not for employment, tenant, or credit screening.
        </p>
      </div>

      <div className={styles.stickyMobileCta}>
        <a href="#signup-form" className={styles.stickyMobileCtaLink} onClick={(e) => { e.preventDefault(); document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ background: '#e11d48' }}>🔓 Unlock {firstName}&apos;s Report →</a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewVariantI;
