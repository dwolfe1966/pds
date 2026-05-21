import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSignup, validatePassword } from '../hooks/useSignup';
import { thinMatchVariant } from '../services/thinMatch';

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

/**
 * Build a small set of synthetic preview cards based on the query. Fields are
 * obviously generic ("J•hn S•••") so the visitor knows these are samples.
 */
function buildPreviewCards(searchType, query) {
  const baseName = searchType === 'name'
    ? [query?.firstName, query?.lastName].filter(Boolean).join(' ')
    : '';
  const state = searchType === 'name' ? (query?.state || '—') : '—';

  return [
    {
      id: 'preview-1',
      title: baseName ? `${maskWord(baseName)}` : 'J•hn S•••',
      ageRange: '30–40',
      locations: [state === '—' ? 'United States' : state, 'Previous: 2 cities'],
    },
    {
      id: 'preview-2',
      title: baseName ? `${maskWord(baseName)}` : 'J•hn S•••',
      ageRange: '40–50',
      locations: [state === '—' ? 'United States' : state, 'Previous: 3 cities'],
    },
    {
      id: 'preview-3',
      title: baseName ? `${maskWord(baseName)}` : 'J•hn S•••',
      ageRange: '50–60',
      locations: [state === '—' ? 'United States' : state, 'Previous: 1 city'],
    },
  ];
}

function maskWord(text) {
  return String(text || '')
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : w[0] + '•'.repeat(Math.max(2, w.length - 2))))
    .join(' ');
}

const ThinMatchPreview = ({ searchType = 'name', query = {}, flags = {} }) => {
  const variant = thinMatchVariant(flags) || 'default';
  const copy = VARIANT_COPY[variant] || VARIANT_COPY.default;
  const cards = useMemo(() => buildPreviewCards(searchType, query), [searchType, query]);

  const { token, isPaid } = useAuth();
  const { submit, loading, error, setError } = useSignup();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [optin, setOptin] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const pwErr = validatePassword(password);
    if (pwErr) { setError(pwErr); return; }
    await submit({ email: email.trim(), password, optin });
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
          color: '#1a56db',
          background: '#dbeafe',
          padding: '0.25rem 0.625rem',
          borderRadius: '999px',
          marginBottom: '0.75rem',
        }}>PREVIEW</span>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 700, color: '#1e3a5f' }}>
          {copy.title}
        </h2>
        <p style={{ margin: 0, color: '#4b5563', lineHeight: 1.55 }}>{copy.body}</p>
      </div>

      {/* Preview cards — obviously sample */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.875rem', marginBottom: '2rem' }}>
        {cards.map((card) => (
          <div key={card.id} style={{
            position: 'relative',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
            padding: '1rem',
            background: '#fff',
            filter: 'blur(0.5px)',
          }}>
            <div style={{
              position: 'absolute', top: '0.5rem', right: '0.5rem',
              background: '#fef3c7', color: '#92400e',
              fontSize: '0.6875rem', fontWeight: 700,
              padding: '0.15rem 0.45rem', borderRadius: 4, letterSpacing: '0.04em',
            }}>SAMPLE</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e3a5f' }}>{card.title}</div>
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
              Age {card.ageRange}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', fontSize: '0.8125rem', color: '#374151' }}>
              {card.locations.map((loc, idx) => (
                <li key={idx} style={{ marginBottom: '0.2rem' }}>📍 {loc}</li>
              ))}
              <li style={{ marginTop: '0.35rem', color: '#9ca3af' }}>• Contact info hidden</li>
              <li style={{ color: '#9ca3af' }}>• Relatives hidden</li>
            </ul>
          </div>
        ))}
      </div>

      {/* CTA — visitor sees inline signup, free member sees upgrade CTA,
          paid member sees a "refine search" hint instead of a payment prompt. */}
      {!token ? (
        <div style={{
          border: '2px solid #1a56db',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          background: '#fff',
        }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#1e3a5f', fontSize: '1.25rem', fontWeight: 700 }}>
            Create an account to unlock full results
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <input
              type="email" required autoComplete="email"
              placeholder="Email address"
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password" required autoComplete="new-password"
              placeholder="Create a password (8+ chars, upper/lower/number/symbol)"
              value={password} onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
            <label style={{ fontSize: '0.8125rem', color: '#4b5563', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <input type="checkbox" checked={optin} onChange={(e) => setOptin(e.target.checked)} />
              <span>Send me product updates and offers (optional).</span>
            </label>
            {error && (
              <div style={{ color: '#b91c1c', fontSize: '0.8125rem' }}>{error}</div>
            )}
            <button type="submit" disabled={loading} style={ctaStyle(loading)}>
              {loading ? 'Creating your account…' : 'Create account & continue'}
            </button>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              🔒 We never notify the person you searched. Your account is private.
            </div>
          </form>
        </div>
      ) : !isPaid ? (
        <div style={{
          border: '2px solid #1a56db',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          background: '#fff',
        }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#1e3a5f', fontSize: '1.25rem', fontWeight: 700 }}>
            Upgrade to view the full report
          </h3>
          <p style={{ margin: '0 0 1rem', color: '#4b5563', fontSize: '0.9rem' }}>
            You're signed in. Add a payment method to unlock contact details, relatives, and full address history.
          </p>
          <Link to="/payment" style={{
            display: 'inline-block',
            padding: '0.875rem 1.25rem',
            background: '#1a56db',
            color: '#fff',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 700,
          }}>
            Upgrade now
          </Link>
        </div>
      ) : (
        <div style={{
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          background: '#f8fafc',
        }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#1e3a5f', fontSize: '1.25rem', fontWeight: 700 }}>
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

const ctaStyle = (loading) => ({
  padding: '0.875rem 1rem',
  background: loading ? '#94a3b8' : '#1a56db',
  color: '#fff',
  border: 'none',
  borderRadius: '0.5rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: loading ? 'wait' : 'pointer',
  marginTop: '0.35rem',
});

export default ThinMatchPreview;
