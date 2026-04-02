import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ZeroResultsPanel — shown on any SERP when the search returns no results.
 *
 * Props:
 *   searchType  'name' | 'phone' | 'email'
 *   query       object  { firstName, lastName, state } | { phone } | { email }
 */
const ZeroResultsPanel = ({ searchType = 'name', query = {} }) => {
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');

  const displayQuery =
    searchType === 'name'
      ? [query.firstName, query.lastName].filter(Boolean).join(' ') + (query.state ? ` in ${query.state}` : '')
      : searchType === 'phone'
      ? query.phone || ''
      : query.email || '';

  const tips =
    searchType === 'name'
      ? [
          'Check the spelling of the first and last name',
          'Try removing the state filter to search nationwide',
          'Use a nickname or alternate name (e.g. "Bob" instead of "Robert")',
          'Try searching by phone number or email address instead',
        ]
      : searchType === 'phone'
      ? [
          'Make sure the number includes the area code',
          'Try removing dashes or spaces from the number',
          'The number may be unlisted — try a name search instead',
        ]
      : [
          'Double-check the email address for typos',
          'Try the person\'s full name search instead',
          'Some email addresses may not be in our database',
        ];

  const handleNameSearch = (e) => {
    e.preventDefault();
    const parts = nameInput.trim().split(/\s+/);
    const first = parts[0] || '';
    const last = parts.slice(1).join(' ') || '';
    if (!first || !last) return;
    sessionStorage.removeItem('nameSearchResults');
    navigate(`/name/loader?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}`);
  };

  const handlePhoneSearch = (e) => {
    e.preventDefault();
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length < 10) return;
    sessionStorage.removeItem('phoneSearchResults');
    navigate(`/phone/loader?phone=${encodeURIComponent(digits)}`);
  };

  const handleEmailSearch = (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    sessionStorage.removeItem('emailSearchResults');
    navigate(`/email/loader?email=${encodeURIComponent(emailInput.trim())}`);
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      {/* Main message */}
      <div style={{
        textAlign: 'center',
        padding: '2.5rem 1.5rem',
        background: '#f8fafc',
        border: '1px solid #e5e7eb',
        borderRadius: '0.75rem',
        marginBottom: '2rem',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔍</div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e3a5f', margin: '0 0 0.5rem' }}>
          No results found{displayQuery ? ` for "${displayQuery}"` : ''}
        </h2>
        <p style={{ color: '#6b7280', fontSize: '1rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
          We searched 12B+ public records but couldn't find an exact match.
          Try one of the suggestions below.
        </p>

        {/* Tips */}
        <ul style={{
          listStyle: 'none',
          margin: '0 auto 1.5rem',
          padding: 0,
          maxWidth: '480px',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}>
          {tips.map((tip, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', color: '#374151', fontSize: '0.9rem' }}>
              <span style={{ color: '#1a56db', fontWeight: 700, flexShrink: 0 }}>✓</span>
              {tip}
            </li>
          ))}
        </ul>

        {/* Trust badge */}
        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
          🔒 Your search is 100% confidential — we never notify the person you searched
        </div>
      </div>

      {/* Alternative search forms */}
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ fontWeight: 600, color: '#1e3a5f', fontSize: '1rem', marginBottom: '1rem' }}>
          Try a different search:
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Name search — show when not already on name */}
          {searchType !== 'name' && (
            <form onSubmit={handleNameSearch} style={altFormStyle}>
              <span style={altLabelStyle}>🔎 Search by Name</span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="First Last"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  required
                  style={inputStyle}
                />
                <button type="submit" style={btnStyle}>Search</button>
              </div>
            </form>
          )}

          {/* Phone search — show when not already on phone */}
          {searchType !== 'phone' && (
            <form onSubmit={handlePhoneSearch} style={altFormStyle}>
              <span style={altLabelStyle}>📞 Search by Phone</span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="tel"
                  placeholder="(555) 555-5555"
                  value={phoneInput}
                  onChange={e => setPhoneInput(e.target.value)}
                  required
                  style={inputStyle}
                />
                <button type="submit" style={btnStyle}>Search</button>
              </div>
            </form>
          )}

          {/* Email search — show when not already on email */}
          {searchType !== 'email' && (
            <form onSubmit={handleEmailSearch} style={altFormStyle}>
              <span style={altLabelStyle}>✉️ Search by Email</span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  required
                  style={inputStyle}
                />
                <button type="submit" style={btnStyle}>Search</button>
              </div>
            </form>
          )}

          {/* Retry same type */}
          {searchType === 'name' && (
            <form onSubmit={handleNameSearch} style={altFormStyle}>
              <span style={altLabelStyle}>🔄 Try a different name</span>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="First Last"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  required
                  style={inputStyle}
                />
                <button type="submit" style={btnStyle}>Search</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const altFormStyle = {
  background: '#f8fafc',
  border: '1px solid #e5e7eb',
  borderRadius: '0.625rem',
  padding: '1rem 1.25rem',
};

const altLabelStyle = {
  display: 'block',
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '0.625rem',
};

const inputStyle = {
  flex: 1,
  minWidth: '180px',
  padding: '0.625rem 0.875rem',
  border: '1px solid #d1d5db',
  borderRadius: '0.375rem',
  fontSize: '0.95rem',
  outline: 'none',
};

const btnStyle = {
  padding: '0.625rem 1.25rem',
  background: '#1a56db',
  color: '#fff',
  border: 'none',
  borderRadius: '0.375rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export default ZeroResultsPanel;
