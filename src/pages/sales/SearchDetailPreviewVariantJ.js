import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';

/**
 * Variant J — "Specificity/proof" (recs R5 + R7).
 * Hypothesis: showing the real DATA SHAPE with only payload characters masked (Spokeo's
 * winning move) converts better than counts alone. Renders char-masked rows ONLY when the
 * BC-derived person object carries partial values (_phonePartial/_emailPartial/_addressPartial
 * or a _relatives name list); otherwise degrades to honest counts — never fabricates a value.
 * Form stays at top. Tracking unchanged (parent teaser_view + submitSignup).
 * Props: person, id
 */
const maskTail = (s, keep = 0) => (typeof s === 'string' && s ? s : '');

const SearchDetailPreviewVariantJ = ({ person, id }) => {
  const brand = useBrand();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submit: submitSignup, loading, error, success } = useSignup();
  const firstName = (person.fullName || 'this person').split(/\s+/)[0];
  const onSubmit = (e) => { e.preventDefault(); submitSignup({ email, password, optin: true, selectedPersonId: id || null }); };

  // Build proof rows from REAL partials when present; mask only the payload characters.
  const rows = [];
  if (person._phonePartial) rows.push({ icon: '📞', label: 'Phone', value: `${maskTail(person._phonePartial)}••••`, tail: person._phoneCount });
  if (person._emailPartial) rows.push({ icon: '✉️', label: 'Email', value: `${maskTail(person._emailPartial)}••••@${person._emailDomain || '•••'}`, tail: person._emailCount });
  if (person._addressPartial) rows.push({ icon: '🏠', label: 'Address', value: `••• ${maskTail(person._addressPartial)}`, tail: person._addressCount });
  const relatives = Array.isArray(person._relatives) ? person._relatives.slice(0, 4) : [];
  const hasRealProof = rows.length > 0 || relatives.length > 0;

  return (
    <main className={styles.main} data-no-nav="true" style={{ background: '#f7f5ff', minHeight: '100vh' }}>
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

      <div className={styles.signupFormCard} id="signup-form" style={{ background: '#1e293b', borderTop: '4px solid #a78bfa' }}>
        <div className={styles.signupFormLockIcon} aria-hidden="true">🔓</div>
        <h2 className={styles.signupFormTitle} style={{ color: '#ffffff' }}>Unlock {firstName}&apos;s full report</h2>
        <p className={styles.signupFormSubtitle}>The records below are real — sign up to reveal them in full.</p>
        {success ? (<div className={styles.signupSuccessMsg}>✅ Account created! Redirecting…</div>) : (
          <form onSubmit={onSubmit} noValidate>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vj-email">Email address</label>
              <input id="vj-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={styles.signupFormInput} placeholder="you@email.com" required autoComplete="email" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vj-password">Create a password</label>
              <input id="vj-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.signupFormInput} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
            </div>
            {error && <div className={styles.formError}>{error === 'already_exists' ? (<>Account exists. <Link to="/login" className={styles.loginLink}>Log in</Link></>) : error}</div>}
            <button type="submit" className={styles.signupSubmitBtn} disabled={loading} style={{ background: '#7c3aed' }}>{loading ? 'Creating account…' : 'Reveal Full Report →'}</button>
            <p className={styles.loginLinkWrap}>Already have an account? <Link to="/login" className={styles.loginLink}>Sign in</Link></p>
          </form>
        )}
        <div className={styles.trustRow}><span>🔒 SSL Encrypted</span><span>🚫 No spam</span></div>
      </div>

      {/* Proof: masked-real rows (R5) when available, else honest counts */}
      <div style={{ margin: '0.5rem 1rem 5rem' }}>
        {hasRealProof ? (
          <>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>Found for {firstName} (sign up to reveal):</p>
            {rows.map((r) => (
              <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.75rem', background: '#f9fafb', border: '1px solid #f0f1f3', borderRadius: '0.5rem', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#374151' }}>{r.icon} {r.label}: <span style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>{r.value}</span></span>
                {r.tail && <span style={{ fontSize: '0.72rem', color: '#92400e' }}>🔒 {r.tail}</span>}
              </div>
            ))}
            {relatives.length > 0 && (
              <div style={{ padding: '0.55rem 0.75rem', background: '#f9fafb', border: '1px solid #f0f1f3', borderRadius: '0.5rem', fontSize: '0.85rem' }}>
                👥 Relatives: {relatives.join(', ')} <span style={{ color: '#92400e' }}>🔒 +details</span>
              </div>
            )}
          </>
        ) : (
          <>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>In {firstName}&apos;s report:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {[['📞', person._phoneCount, 'phone numbers'], ['✉️', person._emailCount, 'emails'], ['🏠', person._addressCount, 'addresses'], ['👥', person._relativeCount, 'relatives']].map(([icon, c, l]) => (
                <span key={l} style={{ fontSize: '0.78rem', color: '#374151', background: '#f9fafb', border: '1px solid #f0f1f3', borderRadius: 999, padding: '0.25rem 0.7rem' }}>{icon} {c ? <strong>{c} </strong> : ''}{l}</span>
              ))}
            </div>
          </>
        )}
        <p style={{ fontSize: '0.66rem', color: '#9ca3af', margin: '0.6rem 0 0', lineHeight: 1.4 }}>
          {brand.name} is not a consumer reporting agency under the FCRA. Not for employment, tenant, or credit screening.
        </p>
      </div>

      <div className={styles.stickyMobileCta}>
        <a href="#signup-form" className={styles.stickyMobileCtaLink} onClick={(e) => { e.preventDefault(); document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' }); }} style={{ background: '#7c3aed' }}>🔓 Reveal Full Report →</a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewVariantJ;
