import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useBrand } from '../../services/brand';

/**
 * Opt-out landing page. Serves two purposes:
 * 1. Normal visitors: search form to find and request opt-out (existing flow)
 * 2. Email confirmation links: automatically confirms opt-out when URL contains
 *    awqh[type]=confirmationRequestOptOut&awqh[optOutRequestId]=<id>
 */
const OptOutLandingPage = () => {
  const navigate = useNavigate();
  const brand = useBrand();
  const [searchParams] = useSearchParams();

  // Opt-out confirmation state (for email link flow)
  const awqhType = searchParams.get('awqh[type]');
  const awqhOptOutRequestId = searchParams.get('awqh[optOutRequestId]');
  const isConfirmationFlow = awqhType === 'confirmationRequestOptOut' && awqhOptOutRequestId;

  const [confirmationStatus, setConfirmationStatus] = useState(
    isConfirmationFlow ? 'loading' : null
  ); // null | 'loading' | 'success' | 'error'

  const [form, setForm] = useState({
    firstName: searchParams.get('firstName') || '',
    lastName: searchParams.get('lastName') || '',
    state: searchParams.get('state') || '',
    zip: searchParams.get('zip') || ''
  });
  const [error, setError] = useState('');

  // Handle opt-out confirmation from email link
  useEffect(() => {
    if (!isConfirmationFlow) return;

    let cancelled = false;
    const confirmOptOut = async () => {
      try {
        await api.confirmOptOut({ optOutRequestId: awqhOptOutRequestId });
        if (!cancelled) setConfirmationStatus('success');
      } catch (err) {
        console.error('[OptOut] Confirmation failed:', err);
        if (!cancelled) setConfirmationStatus('error');
      }
    };

    confirmOptOut();
    return () => { cancelled = true; };
  }, [isConfirmationFlow, awqhOptOutRequestId]);

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

  // Confirmation flow UI (email link handler)
  if (confirmationStatus) {
    return (
      <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: '100%',
          padding: '2.5rem',
          backgroundColor: '#fff',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
          textAlign: 'center',
        }}>
          {confirmationStatus === 'loading' && (
            <>
              <div style={{
                width: '48px', height: '48px', margin: '0 auto 1.5rem',
                border: '4px solid #e5e7eb', borderTopColor: '#0d5d2f',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <h2 style={{ color: '#0d5d2f', marginBottom: '0.75rem' }}>Processing Your Opt-Out Confirmation</h2>
              <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
                Please wait while we verify and process your request...
              </p>
            </>
          )}

          {confirmationStatus === 'success' && (
            <>
              <div style={{
                width: '56px', height: '56px', margin: '0 auto 1.5rem',
                backgroundColor: '#d1fae5', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.75rem',
              }}>
                &#10003;
              </div>
              <h2 style={{ color: '#0d5d2f', marginBottom: '0.75rem' }}>Opt-Out Confirmed</h2>
              <p style={{ color: '#374151', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                Your opt-out request has been confirmed. Your information will be removed within 48 hours.
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
                You may close this page. No further action is required.
              </p>
            </>
          )}

          {confirmationStatus === 'error' && (
            <>
              <div style={{
                width: '56px', height: '56px', margin: '0 auto 1.5rem',
                backgroundColor: '#fee2e2', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.75rem', color: '#dc2626',
              }}>
                !
              </div>
              <h2 style={{ color: '#dc2626', marginBottom: '0.75rem' }}>Unable to Process Confirmation</h2>
              <p style={{ color: '#374151', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                Unable to process your opt-out confirmation. The link may have expired or already been used.
              </p>
              <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Please contact support at <a href={`mailto:${brand.supportEmail}`} style={{ color: '#0d5d2f' }}>{brand.supportEmail}</a> if you need assistance.
              </p>
              <button
                onClick={() => navigate('/opt-out')}
                style={{
                  padding: '0.75rem 2rem',
                  backgroundColor: '#0d5d2f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                }}
              >
                Start New Opt-Out Request
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Opt Out of Public Records</h1>
      <p style={{ marginBottom: '1.25rem', color: '#6b7280', lineHeight: '1.6' }}>
        Search for your record to begin the opt-out process.
      </p>

      {/* Partner bug 24: link to BC's hosted opt-out page per new API docs
          (ApiWrapper.goPage('optOut', { newPage: true })). Our built-in form
          below still works for users who prefer an in-app flow. */}
      <div style={{
        marginBottom: '2rem',
        padding: '1rem 1.25rem',
        background: '#ecfdf5',
        border: '1px solid #bbf7d0',
        borderRadius: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.9rem', color: '#065f46', lineHeight: 1.5 }}>
          Already submitted an opt-out or want the full management page?
        </span>
        <button
          type="button"
          onClick={() => api.openBcOptOutPage({ newPage: true })}
          style={{
            background: '#0d5d2f', color: '#fff', border: 'none',
            padding: '0.55rem 1rem', borderRadius: '0.375rem',
            fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Open opt-out portal →
        </button>
      </div>

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

