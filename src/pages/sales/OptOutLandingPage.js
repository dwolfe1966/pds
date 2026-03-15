import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
/**
 * Opt-out landing page where users search for their record.
 * Accepts optional URL params (firstName, lastName, state, zip) to pre-populate
 * the form when navigating from a report detail page.
 */
const OptOutLandingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    firstName: searchParams.get('firstName') || '',
    lastName: searchParams.get('lastName') || '',
    state: searchParams.get('state') || '',
    zip: searchParams.get('zip') || ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      const state = form.state.trim().toUpperCase();

      if (!firstName || !lastName) {
        throw new Error('Please provide both first and last name.');
      }
      if (!state || state.length !== 2) {
        throw new Error('State is required (2-letter abbreviation).');
      }

      const params = new URLSearchParams({
        q: `${firstName} ${lastName}`.trim(),
        state,
      });

      if (form.zip.trim()) {
        params.set('zip', form.zip.trim());
      }

      navigate(`/opt-out-results?${params.toString()}`);
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Opt Out of Public Records</h1>
      <p style={{ marginBottom: '2rem', color: '#6b7280', lineHeight: '1.6' }}>
        Search for your record to begin the opt-out process.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
            First Name *
          </label>
          <input
            type="text"
            name="firstName"
            value={form.firstName}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
            Last Name *
          </label>
          <input
            type="text"
            name="lastName"
            value={form.lastName}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
              State *
            </label>
            <input
              type="text"
              name="state"
              value={form.state}
              onChange={handleChange}
              required
              maxLength="2"
              placeholder="XX"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', textTransform: 'uppercase' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
              ZIP Code
            </label>
            <input
              type="text"
              name="zip"
              value={form.zip}
              onChange={handleChange}
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
            />
          </div>
        </div>

        {error && (
          <div style={{ padding: '1rem', backgroundColor: '#fee', color: '#c00', borderRadius: '0.375rem', marginBottom: '1rem' }}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        <button
          type="submit"
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#0d5d2f',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease',
          }}
        >
          Search Records
        </button>
      </form>

      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem' }}>
        <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>About Opt-Out</h3>
        <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '1rem' }}>
          We respect your privacy. Search for your record and submit an opt-out request. Once verified, we will remove
          your information from our search results.
        </p>
        <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
          <strong>Note:</strong> The opt-out process requires verification to ensure the request is legitimate. 
          This helps protect against fraudulent removal requests.
        </p>
      </div>
    </main>
  );
};

export default OptOutLandingPage;

