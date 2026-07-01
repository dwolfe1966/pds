import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSignup } from '../../hooks/useSignup';
import { useBrand } from '../../services/brand';

/**
 * Variant I — INMATE-focused signup teaser, "trust-blue" palette (visually matches
 * /name/landing/v3a). Self-contained inline styling (not the shared green card) so it can
 * own the blue palette + orange CTA. Form-first; gated categories are inmate-relevant.
 * Tracking unchanged (parent fires teaser_view; submitSignup fires signup_complete).
 * Honesty: name/age/location are the real record; inmate categories say "In full report"
 * (we don't fabricate facility/charge values). Props: person, id
 */
const P = { blue: '#007cc2', blueDark: '#055a86', orange: '#fd6f0b', ink: '#0f2533', mut: '#5b7484', line: '#d3e3ec', bg: '#eef6fb' };

const SearchDetailPreviewVariantI = ({ person, id }) => {
  const brand = useBrand();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { submit: submitSignup, loading, error, success } = useSignup();
  const firstName = (person.fullName || 'this inmate').split(/\s+/)[0];
  const onSubmit = (e) => { e.preventDefault(); submitSignup({ email, password, optin: true, selectedPersonId: id || null }); };
  const scrollToForm = (e) => { if (e) e.preventDefault(); document.getElementById('signup-form')?.scrollIntoView({ behavior: 'smooth' }); };

  const input = { width: '100%', boxSizing: 'border-box', padding: '0.85rem 0.95rem', fontSize: '1rem', border: `1.5px solid ${P.line}`, borderRadius: 10, outline: 'none', background: '#fff', color: P.ink };
  const btn = { width: '100%', padding: '0.95rem', fontSize: '1.02rem', fontWeight: 800, color: '#fff', background: P.orange, border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: '0 4px 14px rgba(253,111,11,0.35)' };
  const label = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: P.blueDark, margin: '0 0 0.35rem' };

  const cats = [
    { icon: '🏛️', label: 'Current facility & location' },
    { icon: '📋', label: 'Booking & arrest records' },
    { icon: '⚖️', label: 'Charges & case details' },
    { icon: '📸', label: 'Mugshots' },
    { icon: '📅', label: 'Release status & dates' },
  ];

  return (
    <main style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${P.bg} 0%, #fff 40%)` }}>
      {/* Blue mini header */}
      <div style={{ background: `linear-gradient(135deg, ${P.blue}, ${P.blueDark})`, color: '#fff', padding: '0.7rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
        <Link to="/name/search-result" style={{ color: '#fff', textDecoration: 'none', opacity: 0.9 }}>← Back to Results</Link>
        <span style={{ fontWeight: 700 }}>🔒 {brand.name}.ai</span>
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: '1rem 1rem 5rem' }}>
        {/* Identity */}
        <h1 style={{ margin: '0.25rem 0 0.1rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>{person.fullName}</h1>
        {(person.ageRange || person.location) && (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: P.mut }}>
            {person.ageRange ? `Age ${person.ageRange}` : ''}{person.ageRange && person.location ? ' · ' : ''}{person.location || ''}
          </p>
        )}

        {/* Form (top) */}
        <div id="signup-form" style={{ background: '#fff', border: `1px solid ${P.line}`, borderTop: `4px solid ${P.blue}`, borderRadius: 14, padding: '1.4rem 1.25rem', boxShadow: '0 8px 30px rgba(5,90,134,0.10)' }}>
          <div style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔓</div>
          <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.15rem', fontWeight: 800, color: P.ink, textAlign: 'center' }}>Unlock {firstName}&apos;s inmate record</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.86rem', color: P.mut, textAlign: 'center' }}>Facility, booking, charges &amp; release status.</p>
          {success ? (<div style={{ textAlign: 'center', color: P.blueDark, fontWeight: 700 }}>✅ Account created! Redirecting…</div>) : (
            <form onSubmit={onSubmit} noValidate>
              <label style={label} htmlFor="vi-email">Email address</label>
              <input id="vi-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ ...input, marginBottom: '0.75rem' }} placeholder="you@email.com" required autoComplete="email" />
              <label style={label} htmlFor="vi-password">Create a password</label>
              <input id="vi-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...input, marginBottom: '1rem' }} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
              {error && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{error === 'already_exists' ? (<>Account exists. <Link to="/login" style={{ color: P.blue }}>Log in</Link></>) : error}</p>}
              <button type="submit" style={btn} disabled={loading}>{loading ? 'Creating account…' : '🔓 Unlock Record →'}</button>
            </form>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.8rem', fontSize: '0.72rem', color: P.mut }}>
            <span>🔒 SSL Encrypted</span><span>🚫 No spam</span><span>✓ Cancel anytime</span>
          </div>
        </div>

        {/* Gated inmate categories */}
        <p style={{ fontSize: '0.8rem', fontWeight: 800, color: P.blueDark, margin: '1.1rem 0 0.5rem' }}>{firstName}&apos;s report includes:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {cats.map((c) => (
            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.75rem', background: '#fff', border: `1px solid ${P.line}`, borderRadius: 10, fontSize: '0.86rem', color: P.ink }}>
              <span>{c.icon} {c.label}</span>
              <a href="#signup-form" onClick={scrollToForm} style={{ color: P.blue, fontWeight: 700, fontSize: '0.76rem', textDecoration: 'none' }}>🔒 unlock »</a>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.66rem', color: '#9aa7bd', margin: '1rem 0 0', lineHeight: 1.4 }}>
          {brand.name} is not a consumer reporting agency under the FCRA. Not for employment, tenant, or credit screening.
        </p>
      </div>

      <a href="#signup-form" onClick={scrollToForm} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: P.orange, color: '#fff', textAlign: 'center', padding: '0.9rem', fontWeight: 800, textDecoration: 'none', boxShadow: '0 -4px 14px rgba(0,0,0,0.15)' }}>🔓 Unlock Inmate Record — Create Account →</a>
    </main>
  );
};

export default SearchDetailPreviewVariantI;
