import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';

/**
 * Variant A — the DEFAULT SUP. Spokeo-style: the person vCard is the star
 * (name, age, aliases + obfuscated contact data), a compressed set of
 * record-category cards, then a light-touch unlock form with the value +
 * satisfaction copy bulleted BELOW the form.
 *
 * Obfuscation note: at the teaser we only have name/age/aliases and city/state.
 * Street, phone, and email are NOT returned pre-purchase, so we MASK them
 * (real city/state + ••• for the rest) — we do NOT fabricate specific values.
 * When BC returns real contact data at teaser, swap the masks for obfuscated
 * real values.
 */

const CATEGORIES = [
  { icon: '⚖️', title: 'Court Records', items: 'Arrests · Sex offenders · Traffic violations · Felonies' },
  { icon: '📋', title: 'Personal Info', items: 'Birth · Marriage · Divorce · Census & military' },
  { icon: '🏠', title: 'Property & Assets', items: 'Owned properties · Estimated values' },
  { icon: '💼', title: 'Work & Education', items: 'Employment history · Schools attended' },
];

const SearchDetailPreviewVariantA = ({ person, id }) => {
  const brand = useBrand();
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const { submit: submitSignup, loading, error, success } = useSignup();

  const initials = (person.fullName || '?')
    .split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';

  const handleSubmit = (e) => {
    e.preventDefault();
    submitSignup({ email: signupEmail, password: signupPassword, optin: true, selectedPersonId: id || null });
  };

  // Obfuscated contact teaser — real city/state, masked street/phone/email.
  const cityState = person.location || '';
  const addressObf = cityState ? `••••• ••••••, ${cityState}` : 'Available in full report';

  // ── inline styles ──
  const contactRow = (label, value) => (
    <div key={label} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9rem', lineHeight: 1.4 }}>
      <span style={{ color: '#0d5d2f', flexShrink: 0 }}>✓</span>
      <span style={{ color: '#6b7280' }}><strong style={{ color: '#374151', fontWeight: 600 }}>{label}:</strong> {value}</span>
    </div>
  );
  const catCard = { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.7rem 0.85rem' };
  const catTitle = { fontSize: '0.85rem', fontWeight: 700, color: '#0d5d2f', marginBottom: '0.2rem' };
  const catItems = { fontSize: '0.73rem', color: '#6b7280', lineHeight: 1.4 };
  const formLabel = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' };
  const formInput = { width: '100%', boxSizing: 'border-box', padding: '0.75rem 0.85rem', fontSize: '1rem', border: '1.5px solid #d1d5db', borderRadius: '0.5rem', outline: 'none', background: '#fff', color: '#111827' };
  const microcopy = { margin: '0.3rem 0 0', fontSize: '0.75rem', fontStyle: 'italic', color: '#9ca3af' };

  return (
    <main className={styles.main} data-no-nav="true">
      {/* ── Mini header ── */}
      <div className={styles.miniHeader}>
        <Link to="/name/search-result" className={styles.miniHeaderBack}>← Back to Results</Link>
        <span className={styles.miniHeaderBrand}>🔒 {brand.name}</span>
      </div>

      {/* ── VCard — the star ── */}
      <div style={{
        background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.875rem',
        padding: '1.75rem 1.5rem', margin: '1.25rem 1rem 1rem', boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #0d5d2f 0%, #1a7a42 100%)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', fontWeight: 700,
          }}>{initials}</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: '#111827', lineHeight: 1.15 }}>
              {person.fullName}{person.ageRange ? `, Age ${person.ageRange}` : ''}
            </h1>
            {Array.isArray(person.aliases) && person.aliases.length > 0 && (
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.92rem', fontStyle: 'italic', color: '#6b7280' }}>
                aka {person.aliases.slice(0, 3).join(', ')}
              </p>
            )}
          </div>
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7',
          borderRadius: '999px', padding: '0.25rem 0.75rem',
          fontSize: '0.75rem', fontWeight: 600, marginBottom: '1rem',
        }}>✓ Profile verified in our database</div>

        {/* Obfuscated contact data — focuses the user on THIS person */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {contactRow('Current Address', addressObf)}
          {contactRow('Past Addresses', 'More addresses available')}
          {contactRow('Phone Number', '(•••) •••-••••')}
          {contactRow('Email Address', 'See available information')}
        </div>
      </div>

      {/* ── Compressed record categories ── */}
      <div style={{ margin: '0 1rem 1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        {CATEGORIES.map((c) => (
          <div key={c.title} style={catCard}>
            <div style={catTitle}>{c.icon} {c.title}</div>
            <div style={catItems}>{c.items}</div>
          </div>
        ))}
      </div>

      {/* ── Unlock form — light touch ── */}
      <div style={{
        background: '#ffffff', border: '1px solid #e5e7eb', borderTop: '4px solid #0d5d2f',
        borderRadius: '0.875rem', padding: '1.75rem 1.5rem', margin: '0 1rem 1rem',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
      }} id="signup-form">
        <div style={{ textAlign: 'center', fontSize: '1.7rem', marginBottom: '0.25rem' }} aria-hidden="true">🔓</div>
        <h2 style={{ margin: '0 0 1.1rem', textAlign: 'center', fontSize: '1.35rem', fontWeight: 800, color: '#111827' }}>
          Unlock {person.fullName}&apos;s Report
        </h2>

        {success ? (
          <div style={{ textAlign: 'center', color: '#065f46', fontWeight: 600, padding: '1rem 0' }}>
            ✅ Account created! Redirecting to complete your access…
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: '1rem' }}>
              <label style={formLabel} htmlFor="va-email">Email address</label>
              <input id="va-email" type="email" name="email" value={signupEmail}
                onChange={e => setSignupEmail(e.target.value)} style={formInput}
                placeholder="you@email.com" required autoComplete="email" />
              <p style={microcopy}>So we can email your report to you.</p>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={formLabel} htmlFor="va-password">Create a password</label>
              <input id="va-password" type="password" name="password" value={signupPassword}
                onChange={e => setSignupPassword(e.target.value)} style={formInput}
                placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
              <p style={microcopy}>Keeps your report private and secure.</p>
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {error === 'already_exists' ? (
                  <>An account with this email already exists. <Link to="/login" style={{ color: '#991b1b', fontWeight: 600 }}>Log in instead</Link></>
                ) : error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '0.95rem', fontSize: '1.05rem', fontWeight: 800,
              color: '#111827', background: '#f59e0b', border: 'none', borderRadius: '0.6rem',
              cursor: loading ? 'default' : 'pointer', boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
            }}>
              {loading ? 'Unlocking…' : 'Unlock Report →'}
            </button>

            <p style={{ textAlign: 'center', margin: '0.9rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#0d5d2f', fontWeight: 600 }}>Sign in</Link>
            </p>
          </form>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '1rem', fontSize: '0.78rem', color: '#9ca3af' }}>
          <span>🔒 SSL Encrypted</span>
          <span>🚫 No spam</span>
        </div>
      </div>

      {/* ── Reassurance — bulleted, below the form ── */}
      <ul style={{ margin: '0 1rem 1.5rem', padding: '0 0 0 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#4b5563', fontSize: '0.85rem', lineHeight: 1.5 }}>
        <li>Your trial membership includes full access to name, phone, and email searches.</li>
        <li>Your satisfaction is important to us. If you&apos;re not fully satisfied, call our customer care team at <a href="tel:8662041902" style={{ color: '#0d5d2f', fontWeight: 600 }}>866-204-1902</a>.</li>
      </ul>

      {/* ── Sticky mobile CTA ── */}
      <div className={styles.stickyMobileCta}>
        <a href="#signup-form" className={styles.stickyMobileCtaLink}
          onClick={e => { e.preventDefault(); document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' }); }}>
          🔓 Unlock Report →
        </a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewVariantA;
