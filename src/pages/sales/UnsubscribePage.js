import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useBrand } from '../../services/brand';
import { isValidEmail } from '../../utils/email';
import '../../styles/contentContainer.css';

/**
 * Public unsubscribe page (linked from the footer + email unsubscribe links).
 * Lets anyone — registered or not — unsubscribe an email from marketing messages.
 * Deep-links via ?email= so email "unsubscribe" links land here pre-filled.
 *
 * Texts: there is no consumer text/SMS unsubscribe endpoint (BC exposes only
 * unsubscribe/mail), so per TCPA we direct users to reply STOP. A BC ask is filed
 * for a web text-unsubscribe; wire it here when available.
 */
const card = {
  maxWidth: 520, margin: '3rem auto', background: '#fff',
  border: '1px solid #e5e7eb', borderRadius: '0.75rem',
  padding: '2rem 1.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

export default function UnsubscribePage() {
  const brand = useBrand();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState((searchParams.get('email') || '').trim());
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!isValidEmail(value)) { setError('Please enter a valid email address.'); return; }
    setError('');
    setStatus('loading');
    try {
      await api.unsubscribeEmail(value);
      setStatus('done');
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again, or contact support.');
      setStatus('error');
    }
  };

  return (
    <main className="pageBackground">
      <div style={card}>
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 800, color: '#111827' }}>
          Unsubscribe
        </h1>

        {status === 'done' ? (
          <div role="status" style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem',
            padding: '1rem', color: '#166534', fontSize: '0.95rem', lineHeight: 1.5,
          }}>
            <strong>{email}</strong> has been unsubscribed from {brand.name} marketing emails.
            It can take up to 24 hours for the change to take full effect.
          </div>
        ) : (
          <>
            <p style={{ margin: '0 0 1.25rem', color: '#374151', fontSize: '0.95rem', lineHeight: 1.5 }}>
              Enter your email to stop receiving marketing emails from {brand.name}. You'll still get
              essential account and transactional messages (receipts, password resets, support replies).
            </p>
            <form onSubmit={submit} noValidate>
              <label htmlFor="unsub-email" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}>
                Email address
              </label>
              <input
                id="unsub-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '0.7rem 0.85rem',
                  border: `1px solid ${error ? '#dc2626' : '#d1d5db'}`, borderRadius: '0.5rem',
                  fontSize: '1rem', marginBottom: '0.5rem',
                }}
              />
              {error && <p style={{ margin: '0 0 0.75rem', color: '#dc2626', fontSize: '0.85rem' }}>{error}</p>}
              <button
                type="submit"
                disabled={status === 'loading'}
                style={{
                  width: '100%', marginTop: '0.5rem', padding: '0.8rem 1rem',
                  background: '#0d5d2f', color: '#fff', border: 'none', borderRadius: '0.5rem',
                  fontSize: '1rem', fontWeight: 700, cursor: status === 'loading' ? 'default' : 'pointer',
                  opacity: status === 'loading' ? 0.7 : 1,
                }}
              >
                {status === 'loading' ? 'Unsubscribing…' : 'Unsubscribe from emails'}
              </button>
            </form>
          </>
        )}

        <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #e5e7eb' }} />

        <h2 style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
          Text messages
        </h2>
        <p style={{ margin: 0, color: '#374151', fontSize: '0.9rem', lineHeight: 1.5 }}>
          To stop text messages, reply <strong>STOP</strong> to any message you've received from us.
          You can reply <strong>START</strong> at any time to opt back in.
        </p>
      </div>
    </main>
  );
}
