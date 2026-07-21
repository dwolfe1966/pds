import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSignup, generatePassword } from '../hooks/useSignup';
import { thinMatchVariant } from '../services/thinMatch';
import { getCapturedEmail } from '../services/emailCapture';
import { buildPreviewCards } from '../services/previewCards';
import { PersonAvatar } from './PersonAvatar';

/**
 * ThinMatchPreview — shown when the teaser search returns zero or sparse
 * results. Presents preview cards (labeled as samples) + inline signup so the
 * visitor can create an account and continue through the paid funnel.
 *
 * BC's thinMatch flags signal WHY the match is thin; we surface different
 * headers per variant so the copy feels intentional rather than "no results".
 */

const VARIANT_COPY = {
  noResults: {
    title: 'Limited results — unlock full profiles',
    body: "We found limited public-record matches for your search. Sign up to access our full database and see everything we have.",
  },
  thinMatch: {
    title: 'Limited results — unlock full profiles',
    body: "We found limited public-record matches for your search. Sign up to access our full database and see everything we have.",
  },
  geographic: {
    title: 'Narrow geographic match — try a broader search',
    body: "Very few matches in this state. Sign up to search nationwide and see every candidate.",
  },
  tooMany: {
    title: 'Many matches — narrow with a member search',
    body: "This search matches more people than we can display. Sign up to filter by age, city, and other attributes.",
  },
  providerDown: {
    title: "We're refreshing our data",
    body: "Our data provider is refreshing right now. Sign up and we'll deliver your full report the moment it's ready.",
  },
  default: {
    title: 'Unlock the full report',
    body: "Sign up to view contact info, relatives, addresses, and more from public records.",
  },
};

const ThinMatchPreview = ({ searchType = 'name', query = {}, flags = {}, theme = null }) => {
  const variant = thinMatchVariant(flags) || 'default';
  const copy = VARIANT_COPY[variant] || VARIANT_COPY.default;
  const { cards, fullName, stName } = useMemo(() => buildPreviewCards(searchType, query), [searchType, query]);

  // Headline is count/context-framed off the real name + state (except when the
  // provider is genuinely down, where the "refreshing" copy is more honest).
  const inState = stName && stName !== 'the United States' ? ` in ${stName}` : '';
  const headlineTitle = variant === 'providerDown' ? copy.title : `We found people named ${fullName}${inState}`;

  const { token, isPaid } = useAuth();
  const { submit, loading, error, setError } = useSignup();
  // Email already captured upstream (e.g. the v11 BV loader's mid-flow gate)? Then we
  // skip the input and just show Continue. See getCapturedEmail (localStorage lead store).
  const capturedEmail = useMemo(() => getCapturedEmail(), []);
  const [email, setEmail] = useState('');
  const [optin] = useState(true);

  // Unified thin-match CTA (owner 2026-07-21, replaces the v1/v2 A/B): a visitor goes
  // STRAIGHT to payment — email-only signup (auto-generated password, no field), so no
  // interstitial "create a password" page. If the email was already captured, no input
  // at all → one-click Continue. Mirrors SupTeaserA's email-only mechanism.
  const handleContinue = async (e) => {
    e.preventDefault();
    setError('');
    const em = (capturedEmail || email).trim();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setError('Please enter a valid email address.'); return; }
    const pw = generatePassword();
    // _pwAuto tells PaymentPage to REVEAL the auto-generated password on the confirmation
    // screen — without it the member never learns their credentials. (advisor guard)
    try { sessionStorage.setItem('_pwAuto', '1'); } catch { /* storage unavailable */ }
    // No target report → PaymentPage runs in general/promo mode (→ dashboard after subscribe).
    await submit({ email: em, password: pw, optin, redirectParam: '/payment' });
  };

  return (
    <div style={{ padding: '1.5rem 0' }}>
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e5e7eb',
        borderRadius: '0.75rem',
        padding: '1.75rem 1.5rem',
        marginBottom: '1.5rem',
      }}>
        <span style={{
          display: 'inline-block',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          color: theme ? theme.accentDark : '#0d5d2f',
          background: theme ? (theme.onDark ? 'rgba(245,158,11,0.15)' : '#e6f3fa') : '#dcfce7',
          padding: '0.25rem 0.625rem',
          borderRadius: '999px',
          marginBottom: '0.75rem',
        }}>PREVIEW</span>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
          {headlineTitle}
        </h2>
      </div>

      {/* Preview cards — SERP result-card format (ribbon + avatar + name/age, body with
          location/relatives), contact details locked. Ribbons alternate green/gray. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.875rem', marginBottom: '2rem' }}>
        {cards.map((card, i) => (
          <div key={card.id} style={{ border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden', background: '#fff', boxShadow: '0 4px 14px rgba(17,24,39,0.08), 0 1px 3px rgba(17,24,39,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.7rem 1rem', background: i % 2 === 1 ? '#f1f5f9' : '#e6f4ec', borderBottom: `1px solid ${i % 2 === 1 ? '#e5e7eb' : '#c7e6d3'}` }}>
              <PersonAvatar person={{ fullName: card.fullName }} size={40} />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.fullName}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>{card.age}</span>
              </div>
            </div>
            <div style={{ padding: '0.85rem 1.1rem 1rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#374151' }}><span style={{ color: '#6b7280', fontWeight: 600 }}>Location </span>{card.city}, {card.stCode}</p>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: '#374151' }}><span style={{ color: '#6b7280', fontWeight: 600 }}>Relatives </span>{card.relatives.slice(0, 2).join(', ')}{card.relatives.length > 2 ? ` +${card.relatives.length - 2}` : ''}</p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#9ca3af', filter: 'blur(3.5px)', userSelect: 'none' }}>📞 (555) 214-8890 · name@email.com</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#0d5d2f', fontWeight: 600 }}>🔒 {card.phones} phones · {card.emails} emails · {card.prevAddresses} past addresses</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA — unified Continue→payment. Visitor: email-only signup (no password field)
          straight to payment; if the email was already captured upstream (v11 BV flow) we
          skip the input → one-click Continue. Free member: Continue to payment. Paid member:
          refine hint. The "Refine Search" form renders below this (in SearchResultsPage). */}
      {!token ? (
        <div style={{
          border: '2px solid #0d5d2f',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          background: '#fff',
        }}>
          <h3 style={{ margin: '0 0 0.75rem', color: '#111827', fontSize: '1.25rem', fontWeight: 700 }}>
            View full results
          </h3>
          <form onSubmit={handleContinue} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {!capturedEmail && (
              <input
                type="email" autoComplete="email"
                placeholder="Email address"
                value={email} onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
              />
            )}
            {error && (
              <div style={{ color: '#b91c1c', fontSize: '0.8125rem' }}>
                {error === 'already_exists' ? 'That email already has an account — please sign in to continue.' : error}
              </div>
            )}
            <button type="submit" disabled={loading} style={ctaStyle(loading, theme)}>
              {loading ? 'One moment…' : 'Continue'}
            </button>
          </form>
          {capturedEmail && (
            <p style={{ margin: '0.6rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>Continuing as {capturedEmail}</p>
          )}
        </div>
      ) : !isPaid ? (
        <div style={{
          border: '2px solid #0d5d2f',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          background: '#fff',
        }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#111827', fontSize: '1.25rem', fontWeight: 700 }}>
            View full results
          </h3>
          <p style={{ margin: '0 0 1rem', color: '#4b5563', fontSize: '0.9rem' }}>
            You're signed in. Add a payment method to unlock contact details, relatives, and full address history.
          </p>
          <Link to="/payment" style={{
            display: 'inline-block',
            padding: '0.875rem 1.25rem',
            background: '#0d5d2f',
            color: '#fff',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 700,
          }}>
            Continue
          </Link>
        </div>
      ) : (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          background: '#f8fafc',
        }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#111827', fontSize: '1.25rem', fontWeight: 700 }}>
            Try a different search
          </h3>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.9rem' }}>
            Limited matches for this query. Add a state, refine the spelling, or try /people-search for member-only filters.
          </p>
        </div>
      )}
    </div>
  );
};

const inputStyle = {
  padding: '0.75rem 0.875rem',
  border: '1px solid #d1d5db',
  borderRadius: '0.375rem',
  fontSize: '0.95rem',
  outline: 'none',
};

const ctaStyle = (loading, theme) => ({
  padding: '0.875rem 1rem',
  background: loading ? '#94a3b8' : (theme ? theme.button : '#0d5d2f'),
  color: '#fff',
  border: 'none',
  borderRadius: '0.5rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: loading ? 'wait' : 'pointer',
  marginTop: '0.35rem',
});

export default ThinMatchPreview;
