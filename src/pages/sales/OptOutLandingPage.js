import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../../api';

/**
 * Opt-out landing page. Two surfaces:
 *
 * 1. Email confirmation deep-link: when BC's confirmation email lands the
 *    user here with `awqh[type]=confirmationRequestOptOut&awqh[optOutRequestId]=<id>`,
 *    we call api.confirmOptOut and show the result.
 *
 * 2. Normal visit: explainer copy + CTA that hands off to BC's hosted
 *    opt-out portal via ApiWrapper.goPage('optOut', { newPage }). BC owns
 *    the full search → request → verification flow; we don't duplicate it.
 */
const OptOutLandingPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const awqhType = searchParams.get('awqh[type]');
  const awqhOptOutRequestId = searchParams.get('awqh[optOutRequestId]');
  const isConfirmationFlow = awqhType === 'confirmationRequestOptOut' && awqhOptOutRequestId;

  const [confirmationStatus, setConfirmationStatus] = useState(
    isConfirmationFlow ? 'loading' : null
  ); // null | 'loading' | 'success' | 'error'

  useEffect(() => {
    if (!isConfirmationFlow) return;
    let cancelled = false;
    (async () => {
      try {
        await api.confirmOptOut({ optOutRequestId: awqhOptOutRequestId });
        if (!cancelled) setConfirmationStatus('success');
      } catch (err) {
        console.error('[OptOut] Confirmation failed:', err);
        if (!cancelled) setConfirmationStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [isConfirmationFlow, awqhOptOutRequestId]);

  const handleOpenPortal = (newPage) => {
    api.openBcOptOutPage({ newPage });
  };

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
                Please <Link to="/contact" style={{ color: '#0d5d2f' }}>contact support</Link> if you need assistance.
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
    <main style={{ padding: '2.5rem 1.5rem', maxWidth: '640px', margin: '0 auto' }}>
      <h1 style={{ color: '#0d5d2f', marginBottom: '0.75rem', fontSize: '1.75rem' }}>
        Opt Out of Public Records
      </h1>
      <p style={{ marginBottom: '1.5rem', color: '#374151', lineHeight: 1.6 }}>
        Remove your information from our index by searching for your record and submitting an opt-out request.
        The full process — search, verification, and confirmation — runs in our secure opt-out portal.
      </p>

      <div style={{
        padding: '1.25rem 1.5rem',
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '0.5rem',
        marginBottom: '1.5rem',
      }}>
        <h2 style={{ fontSize: '1rem', color: '#065f46', margin: '0 0 0.5rem', fontWeight: 700 }}>
          What you'll need
        </h2>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#065f46', fontSize: '0.9rem', lineHeight: 1.7 }}>
          <li>Your first and last name</li>
          <li>The state where you currently live (or recently lived)</li>
          <li>An email address to receive the confirmation link</li>
        </ul>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => handleOpenPortal(false)}
          style={{
            width: '100%',
            padding: '0.95rem 1.25rem',
            background: '#0d5d2f',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Open Opt-Out Portal
        </button>
        <button
          type="button"
          onClick={() => handleOpenPortal(true)}
          style={{
            width: '100%',
            padding: '0.7rem 1.25rem',
            background: '#fff',
            color: '#0d5d2f',
            border: '1px solid #0d5d2f',
            borderRadius: '0.5rem',
            fontSize: '0.92rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Open in a new tab instead
        </button>
      </div>

      <p style={{ fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.5, marginBottom: '0.75rem' }}>
        After submitting, you'll receive a confirmation email. Click the link in that email to complete your opt-out
        — your information will be removed within 48 hours of confirmation.
      </p>
      <p style={{ fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.5 }}>
        Need help? <Link to="/contact" style={{ color: '#0d5d2f' }}>Contact support</Link>.
      </p>
    </main>
  );
};

export default OptOutLandingPage;
