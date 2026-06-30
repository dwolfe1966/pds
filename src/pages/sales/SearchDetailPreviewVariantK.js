import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';

/**
 * Variant K — "Anticipation + scope" (recs R10 + R12).
 * Hypothesis: a short branded "Searching…%" reveal (anticipation/effort-justification, PF's
 * device) + escalating-scope count copy lifts perceived value → signup. The loader is SHORT
 * (~1.6s) and honest ("Compiling {first}'s records") — not a fake multi-second stall.
 * Scope copy uses BC-derived counts; "records may be available" when absent (no fabrication).
 * Tracking unchanged (parent teaser_view + submitSignup). Props: person, id
 */
const SearchDetailPreviewVariantK = ({ person, id }) => {
  const brand = useBrand();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pct, setPct] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const { submit: submitSignup, loading, error, success } = useSignup();
  const firstName = (person.fullName || 'this person').split(/\s+/)[0];
  const onSubmit = (e) => { e.preventDefault(); submitSignup({ email, password, optin: true, selectedPersonId: id || null }); };

  useEffect(() => {
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + 12 + Math.round(p / 12));
      setPct(p);
      if (p >= 100) { clearInterval(t); setTimeout(() => setRevealed(true), 250); }
    }, 180);
    return () => clearInterval(t);
  }, []);

  if (!revealed) {
    return (
      <main className={styles.main} data-no-nav="true">
        <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔎</div>
          <p style={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem', textAlign: 'center' }}>
            Compiling {firstName}&apos;s records…
          </p>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 1.25rem' }}>Searching public records</p>
          <div style={{ width: '220px', height: '8px', background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg,#1a7a42,#0d5d2f)', transition: 'width 0.18s ease' }} />
          </div>
          <p style={{ fontSize: '0.8rem', color: '#1a7a42', fontWeight: 700, margin: '0.5rem 0 0' }}>{pct}%</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main} data-no-nav="true">
      <div className={styles.miniHeader}>
        <Link to="/name/search-result" className={styles.miniHeaderBack}>← Back to Results</Link>
        <span className={styles.miniHeaderBrand}>🔒 {brand.name}.ai</span>
      </div>

      {/* Scope banner (R12) */}
      <div style={{ margin: '0.9rem 1rem 0.4rem', padding: '0.7rem 0.9rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.625rem' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#92400e' }}>
          ✅ Records located for {person.fullName}
        </p>
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#b45309' }}>
          {[person._phoneCount && `${person._phoneCount} phone`, person._addressCount && `${person._addressCount} address`, person._relativeCount && `${person._relativeCount} relative`].filter(Boolean).join(' · ') || 'Contact info, addresses & relatives'} records — plus court &amp; criminal records may be available.
        </p>
      </div>

      <div className={styles.signupFormCard} id="signup-form">
        <div className={styles.signupFormLockIcon} aria-hidden="true">🔓</div>
        <h2 className={styles.signupFormTitle}>Unlock {firstName}&apos;s full report</h2>
        <p className={styles.signupFormSubtitle}>Create your account to see everything we found.</p>
        {success ? (<div className={styles.signupSuccessMsg}>✅ Account created! Redirecting…</div>) : (
          <form onSubmit={onSubmit} noValidate>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vk-email">Email address</label>
              <input id="vk-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.signupFormInput} placeholder="you@email.com" required autoComplete="email" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vk-password">Create a password</label>
              <input id="vk-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.signupFormInput} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
            </div>
            {error && <div className={styles.formError}>{error === 'already_exists' ? (<>Account exists. <Link to="/login" className={styles.loginLink}>Log in</Link></>) : error}</div>}
            <button type="submit" className={styles.signupSubmitBtn} disabled={loading}>{loading ? 'Creating account…' : 'See Full Report →'}</button>
            <p className={styles.loginLinkWrap}>Already have an account? <Link to="/login" className={styles.loginLink}>Sign in</Link></p>
          </form>
        )}
        <div className={styles.trustRow}><span>🔒 SSL Encrypted</span><span>🚫 No spam</span></div>
      </div>

      <p style={{ margin: '0.6rem 1rem 5rem', fontSize: '0.66rem', color: '#9ca3af', lineHeight: 1.4 }}>
        {brand.name} is not a consumer reporting agency under the FCRA. Not for employment, tenant, or credit screening.
      </p>

      <div className={styles.stickyMobileCta}>
        <a href="#signup-form" className={styles.stickyMobileCtaLink} onClick={(e) => { e.preventDefault(); document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' }); }}>🔓 See Full Report →</a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewVariantK;
