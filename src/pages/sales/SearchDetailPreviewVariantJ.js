import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import { useBrand } from '../../services/brand';
import ColorLandingFooter from './ColorLandingFooter';

/**
 * Variant J — INMATE-focused signup teaser, "dark premium" palette (visually matches
 * /name/landing/v3b). Self-contained inline styling (charcoal + amber). Form-first; gated
 * categories are inmate-relevant. Tracking unchanged (parent teaser_view; submitSignup →
 * signup_complete). Honesty: real name/age/location; inmate categories not fabricated.
 * Props: person, id
 */
const P = { bg0: '#0f1629', bg1: '#16213e', panel: '#1e2a47', amber: '#f59e0b', amberDk: '#d97706', ink: '#eef2f9', mut: '#9aa7bd', line: 'rgba(255,255,255,0.12)' };

const SearchDetailPreviewVariantJ = ({ person, id }) => {
  const brand = useBrand();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submit: submitSignup, loading, error, success } = useSignup();
  const firstName = (person.fullName || 'this inmate').split(/\s+/)[0];
  const onSubmit = (e) => { e.preventDefault(); submitSignup({ email, password, optin: true, selectedPersonId: id || null }); };
  const scrollToForm = (e) => { if (e) e.preventDefault(); document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' }); };

  const input = { width: '100%', boxSizing: 'border-box', padding: '0.85rem 0.95rem', fontSize: '1rem', border: `1.5px solid ${P.line}`, borderRadius: 10, outline: 'none', background: 'rgba(255,255,255,0.06)', color: P.ink };
  const btn = { width: '100%', padding: '0.95rem', fontSize: '1.02rem', fontWeight: 800, color: '#1a1206', background: `linear-gradient(180deg, ${P.amber}, ${P.amberDk})`, border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: '0 6px 18px rgba(245,158,11,0.35)' };
  const label = { display: 'block', fontSize: '0.78rem', fontWeight: 700, color: P.mut, margin: '0 0 0.35rem' };

  const cats = [
    { icon: '🏛️', label: 'Current facility & location' },
    { icon: '📋', label: 'Booking & arrest records' },
    { icon: '⚖️', label: 'Charges & case details' },
    { icon: '📸', label: 'Mugshots' },
    { icon: '📅', label: 'Release status & dates' },
  ];

  return (
    <main style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${P.bg0} 0%, ${P.bg1} 100%)`, color: P.ink }}>
      {/* Dark mini header */}
      <div style={{ padding: '0.7rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', borderBottom: `1px solid ${P.line}` }}>
        <Link to="/name/search-result" style={{ color: P.mut, textDecoration: 'none' }}>← Back to Results</Link>
        <span style={{ fontWeight: 700, color: P.amber }}>🔒 {brand.name}.ai</span>
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: '1rem 1rem 5rem' }}>
        <h1 style={{ margin: '0.25rem 0 0.1rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>{person.fullName}</h1>
        {(person.ageRange || person.location) && (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: P.mut }}>
            {person.ageRange ? `Age ${person.ageRange}` : ''}{person.ageRange && person.location ? ' · ' : ''}{person.location || ''}
          </p>
        )}

        {/* Form (top) */}
        <div id="signup-form" style={{ background: P.bg1, border: `1px solid ${P.line}`, borderTop: `4px solid ${P.amber}`, borderRadius: 14, padding: '1.4rem 1.25rem' }}>
          <div style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔓</div>
          <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.15rem', fontWeight: 800, color: P.ink, textAlign: 'center' }}>Unlock {firstName}&apos;s inmate record</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.86rem', color: P.mut, textAlign: 'center' }}>Facility, booking, charges &amp; release status.</p>
          {success ? (<div style={{ textAlign: 'center', color: P.amber, fontWeight: 700 }}>✅ Account created! Redirecting…</div>) : (
            <form onSubmit={onSubmit} noValidate>
              <label style={label} htmlFor="vj-email">Email address</label>
              <input id="vj-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, marginBottom: '0.75rem' }} placeholder="you@email.com" required autoComplete="email" />
              <label style={label} htmlFor="vj-password">Create a password</label>
              <input id="vj-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...input, marginBottom: '1rem' }} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
              {error && <p style={{ color: '#fca5a5', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{error === 'already_exists' ? (<>Account exists. <Link to="/login" style={{ color: P.amber }}>Log in</Link></>) : error}</p>}
              <button type="submit" style={btn} disabled={loading}>{loading ? 'Creating account…' : '🔓 Unlock Record →'}</button>
            </form>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.8rem', fontSize: '0.72rem', color: P.mut }}>
            <span>🔒 SSL Encrypted</span><span>🚫 No spam</span><span>✓ Cancel anytime</span>
          </div>
        </div>

        {/* Gated inmate categories */}
        <p style={{ fontSize: '0.8rem', fontWeight: 800, color: P.amber, margin: '1.1rem 0 0.5rem' }}>{firstName}&apos;s report includes:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {cats.map((c) => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.75rem', background: P.panel, border: `1px solid ${P.line}`, borderRadius: 10, fontSize: '0.86rem', color: P.ink }}>
              <span>{c.icon} {c.label}</span>
              <a href="#signup-form" onClick={scrollToForm} style={{ color: P.amber, fontWeight: 700, fontSize: '0.76rem', textDecoration: 'none' }}>🔒 unlock »</a>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.66rem', color: P.mut, margin: '1rem 0 0', lineHeight: 1.4 }}>
          {brand.name} is not a consumer reporting agency under the FCRA. Not for employment, tenant, or credit screening.
        </p>
      </div>

      <ColorLandingFooter bg={P.bg0} fg="rgba(255,255,255,0.7)" accent={P.amber} />
      <div style={{ height: 60 }} aria-hidden="true" />

      <a href="#signup-form" onClick={scrollToForm} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: `linear-gradient(180deg, ${P.amber}, ${P.amberDk})`, color: '#1a1206', textAlign: 'center', padding: '0.9rem', fontWeight: 800, textDecoration: 'none' }}>🔓 Unlock Inmate Record — Create Account →</a>
    </main>
  );
};

export default SearchDetailPreviewVariantJ;
