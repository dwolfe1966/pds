import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import { useBrand } from '../../services/brand';

/**
 * Shared "default SUP" teaser (the variant-A design), driven by a `palette` so
 * the same layout/copy can be re-skinned per funnel:
 *   - variant A  → green (default)
 *   - variant I  → trust-blue (inmate A/B, matches landing v3a)
 *   - variant J  → dark/amber (inmate A/B, matches landing v3b)
 *
 * Structure: hook line → vCard (name/age/aliases + OBFUSCATED contact rows —
 * masked, never fabricated) → compressed record-category cards → light unlock
 * form (inline italic field notes) → bulleted trial + satisfaction copy.
 *
 * Palette keys: pageBg, ink, ink2, mut, muted, accent, accentGrad, cardBg,
 * cardBorder, chipBg, formBg, formBorder, inputBg, inputBorder, cta, ctaText,
 * verifiedBg, verifiedText, verifiedBorder, headerBg, headerText, onDark.
 */

const CATEGORIES = [
  { icon: '⚖️', title: 'Court Records', items: 'Arrests · Sex offenders · Traffic violations · Felonies' },
  { icon: '📋', title: 'Personal Info', items: 'Birth · Marriage · Divorce · Census & military' },
  { icon: '🏠', title: 'Property & Assets', items: 'Owned properties · Estimated values' },
  { icon: '💼', title: 'Work & Education', items: 'Employment history · Schools attended' },
];

const SupTeaserA = ({ person, id, palette: P }) => {
  const brand = useBrand();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submit: submitSignup, loading, error, success } = useSignup();

  const initials = (person.fullName || '?')
    .split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';
  const cityState = person.location || '';
  const addressObf = cityState ? `••••• ••••••, ${cityState}` : 'Available in full report';

  const handleSubmit = (e) => {
    e.preventDefault();
    submitSignup({ email, password, optin: true, selectedPersonId: id || null });
  };
  const scrollToForm = (e) => { if (e) e.preventDefault(); document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' }); };

  const card = { background: P.cardBg, border: `1px solid ${P.cardBorder}`, borderRadius: '0.875rem', padding: '1.75rem 1.5rem', margin: '0.6rem 1rem 1rem', boxShadow: P.onDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 2px 10px rgba(0,0,0,0.06)' };
  const formLabel = { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: P.ink2, marginBottom: '0.3rem' };
  const labelNote = { fontWeight: 400, fontStyle: 'italic' };
  const formInput = { width: '100%', boxSizing: 'border-box', padding: '0.75rem 0.85rem', fontSize: '1rem', border: `1.5px solid ${P.inputBorder}`, borderRadius: '0.5rem', outline: 'none', background: P.inputBg, color: P.ink };

  const contactRow = (label, value) => (
    <div key={label} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9rem', lineHeight: 1.4 }}>
      <span style={{ color: P.accent, flexShrink: 0 }}>✓</span>
      <span style={{ color: P.mut }}><strong style={{ color: P.ink2, fontWeight: 600 }}>{label}:</strong> {value}</span>
    </div>
  );

  return (
    <main data-no-nav="true" style={{ minHeight: '100vh', background: P.pageBg }}>
      {/* Mini header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem 1rem', background: P.headerBg, color: P.headerText, fontSize: '0.85rem' }}>
        <Link to="/name/search-result" style={{ color: P.headerText, textDecoration: 'none', opacity: 0.9 }}>← Back to Results</Link>
        <span style={{ fontWeight: 700 }}>🔒 {brand.name}</span>
      </div>

      {/* Hook line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1.1rem 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: P.ink }}>
        <span style={{ color: P.accent, fontSize: '1.15rem' }} aria-hidden="true">✓</span>
        Get Instant Information on {person.fullName}
      </div>

      {/* VCard */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', flexShrink: 0, background: P.accentGrad, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 700 }}>{initials}</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: P.ink, lineHeight: 1.15 }}>
              {person.fullName}{person.ageRange ? `, Age ${person.ageRange}` : ''}
            </h1>
            {Array.isArray(person.aliases) && person.aliases.length > 0 && (
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.92rem', fontStyle: 'italic', color: P.mut }}>
                aka {person.aliases.slice(0, 3).join(', ')}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: P.verifiedBg, color: P.verifiedText, border: `1px solid ${P.verifiedBorder}`, borderRadius: '999px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, marginBottom: '1rem' }}>
          ✓ Profile verified in our database
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {contactRow('Current Address', addressObf)}
          {contactRow('Past Addresses', 'More addresses available')}
          {contactRow('Phone Number', '(•••) •••-••••')}
          {contactRow('Email Address', 'See available information')}
        </div>
      </div>

      {/* Compressed record categories */}
      <div style={{ margin: '0 1rem 1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
        {CATEGORIES.map((c) => (
          <div key={c.title} style={{ background: P.chipBg, border: `1px solid ${P.cardBorder}`, borderRadius: '0.6rem', padding: '0.7rem 0.85rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: P.accent, marginBottom: '0.2rem' }}>{c.icon} {c.title}</div>
            <div style={{ fontSize: '0.73rem', color: P.mut, lineHeight: 1.4 }}>{c.items}</div>
          </div>
        ))}
      </div>

      {/* Unlock form */}
      <div id="signup-form" style={{ background: P.formBg, border: `1px solid ${P.formBorder}`, borderRadius: '0.875rem', padding: '1.75rem 1.5rem', margin: '0 1rem 1rem', boxShadow: P.onDark ? '0 8px 30px rgba(0,0,0,0.35)' : '0 2px 10px rgba(0,0,0,0.05)' }}>
        <div style={{ textAlign: 'center', fontSize: '1.7rem', marginBottom: '0.25rem' }} aria-hidden="true">🔓</div>
        <h2 style={{ margin: '0 0 1.1rem', textAlign: 'center', fontSize: '1.35rem', fontWeight: 800, color: P.ink }}>
          Unlock {person.fullName}&apos;s Report
        </h2>

        {success ? (
          <div style={{ textAlign: 'center', color: P.accent, fontWeight: 600, padding: '1rem 0' }}>
            ✅ Account created! Redirecting to complete your access…
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: '1rem' }}>
              <label style={formLabel} htmlFor="sup-email">Email address <span style={labelNote}>— so we can email your report to you.</span></label>
              <input id="sup-email" type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} style={formInput} placeholder="you@email.com" required autoComplete="email" />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={formLabel} htmlFor="sup-password">Create a password <span style={labelNote}>— keeps your report private and secure.</span></label>
              <input id="sup-password" type="password" name="password" value={password} onChange={e => setPassword(e.target.value)} style={formInput} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {error === 'already_exists' ? (<>An account with this email already exists. <Link to="/login" style={{ color: '#991b1b', fontWeight: 600 }}>Log in instead</Link></>) : error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.95rem', fontSize: '1.05rem', fontWeight: 800, color: P.ctaText, background: P.cta, border: 'none', borderRadius: '0.6rem', cursor: loading ? 'default' : 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              {loading ? 'Unlocking…' : 'Unlock Report →'}
            </button>

            <p style={{ textAlign: 'center', margin: '0.9rem 0 0', fontSize: '0.85rem', color: P.mut }}>
              Already have an account? <Link to="/login" style={{ color: P.accent, fontWeight: 600 }}>Sign in</Link>
            </p>
          </form>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.25rem', marginTop: '1rem', fontSize: '0.78rem', color: P.muted }}>
          <span>🔒 SSL Encrypted</span>
          <span>🚫 No spam</span>
        </div>
      </div>

      {/* Reassurance — bulleted, below the form */}
      <ul style={{ margin: '0 1rem 1.5rem', padding: '0 0 0 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', color: P.mut, fontSize: '0.85rem', lineHeight: 1.5 }}>
        <li>Your trial membership includes full access to name, phone, and email searches.</li>
        <li>Your satisfaction is important to us. If you&apos;re not fully satisfied, call our customer care team at <a href="tel:8662041902" style={{ color: P.accent, fontWeight: 600 }}>866-204-1902</a>.</li>
      </ul>

      {/* Sticky mobile CTA */}
      <a href="#signup-form" onClick={scrollToForm} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: P.cta, color: P.ctaText, textAlign: 'center', padding: '0.9rem', fontWeight: 800, textDecoration: 'none', boxShadow: '0 -4px 14px rgba(0,0,0,0.15)' }}>
        🔓 Unlock Report →
      </a>
    </main>
  );
};

export const SUP_PALETTE_GREEN = {
  pageBg: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 40%)',
  ink: '#111827', ink2: '#374151', mut: '#6b7280', muted: '#9ca3af',
  accent: '#0d5d2f', accentGrad: 'linear-gradient(135deg, #0d5d2f 0%, #1a7a42 100%)',
  cardBg: '#ffffff', cardBorder: '#e5e7eb', chipBg: '#f9fafb',
  formBg: '#f0fdf4', formBorder: '#bbf7d0', inputBg: '#ffffff', inputBorder: '#d1d5db',
  cta: '#f59e0b', ctaText: '#111827',
  verifiedBg: '#d1fae5', verifiedText: '#065f46', verifiedBorder: '#6ee7b7',
  headerBg: '#ffffff', headerText: '#0d5d2f', onDark: false,
};

export const SUP_PALETTE_BLUE = {
  pageBg: 'linear-gradient(180deg, #eef6fb 0%, #ffffff 40%)',
  ink: '#0f2533', ink2: '#0f2533', mut: '#5b7484', muted: '#8aa0b0',
  accent: '#007cc2', accentGrad: 'linear-gradient(135deg, #007cc2 0%, #055a86 100%)',
  cardBg: '#ffffff', cardBorder: '#d3e3ec', chipBg: '#f4f9fc',
  formBg: '#eef6fb', formBorder: '#cfe6f2', inputBg: '#ffffff', inputBorder: '#d3e3ec',
  cta: '#fd6f0b', ctaText: '#ffffff',
  verifiedBg: '#dbeafe', verifiedText: '#055a86', verifiedBorder: '#93c5fd',
  headerBg: 'linear-gradient(135deg, #007cc2, #055a86)', headerText: '#ffffff', onDark: false,
};

export const SUP_PALETTE_DARK = {
  pageBg: 'linear-gradient(180deg, #0f1629 0%, #16213e 100%)',
  ink: '#eef2f9', ink2: '#eef2f9', mut: '#9aa7bd', muted: '#7a869c',
  accent: '#f59e0b', accentGrad: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  cardBg: '#1e2a47', cardBorder: 'rgba(255,255,255,0.12)', chipBg: 'rgba(255,255,255,0.04)',
  formBg: '#1e2a47', formBorder: 'rgba(255,255,255,0.12)', inputBg: 'rgba(255,255,255,0.06)', inputBorder: 'rgba(255,255,255,0.12)',
  cta: 'linear-gradient(180deg, #f59e0b, #d97706)', ctaText: '#1a1206',
  verifiedBg: 'rgba(245,158,11,0.14)', verifiedText: '#fbbf24', verifiedBorder: 'rgba(245,158,11,0.4)',
  headerBg: '#0f1629', headerText: '#eef2f9', onDark: true,
};

export default SupTeaserA;
