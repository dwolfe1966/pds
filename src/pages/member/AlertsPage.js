import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './AlertsPage.module.css';

/**
 * AlertsPage — entry point for "set up an alert."
 *
 * BC has no alerts/scheduling endpoint, so creating an alert just routes
 * the user into the matching search flow with their criteria pre-filled.
 * No persistence, no list of saved alerts — every submission immediately
 * runs a search instead.
 */

function detectSearchType(raw) {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  // Email — contains @
  if (trimmed.includes('@')) return { type: 'email', value: trimmed.toLowerCase() };
  // Phone — strip non-digits, expect ≥10
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10) return { type: 'phone', value: digits };
  // Otherwise — name. Split on whitespace into first/last.
  const parts = trimmed.split(/\s+/);
  return {
    type: 'name',
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || '',
  };
}

const AlertsPage = () => {
  const navigate = useNavigate();
  const [criteria, setCriteria] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const parsed = detectSearchType(criteria);
    if (!parsed) {
      setError('Enter a name, phone number, or email to search.');
      return;
    }
    if (parsed.type === 'email') {
      navigate(`/email/loader?email=${encodeURIComponent(parsed.value)}`);
    } else if (parsed.type === 'phone') {
      navigate(`/phone/loader?phone=${encodeURIComponent(parsed.value)}`);
    } else {
      if (!parsed.firstName || !parsed.lastName) {
        setError('Enter both a first and last name to search by name.');
        return;
      }
      const params = new URLSearchParams({
        firstName: parsed.firstName,
        lastName: parsed.lastName,
      }).toString();
      navigate(`/name/loader?${params}`);
    }
  };

  return (
    <main className={styles.pageWrapper}>
      {/* Coming-soon banner — continuous-alert monitoring isn't shipped yet.
          The form below runs a one-time search; pattern matches WSFY. */}
      <div
        role="status"
        style={{
          marginBottom: '1.25rem',
          background: '#fffbeb',
          border: '1px solid #f59e0b',
          borderRadius: '0.5rem',
          padding: '0.875rem 1.125rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: '1.25rem', lineHeight: 1 }}>🔔</span>
        <div>
          <p style={{ margin: 0, fontWeight: 700, color: '#92400e', fontSize: '0.95rem' }}>
            Coming soon
          </p>
          <p style={{ margin: '0.25rem 0 0', color: '#78350f', fontSize: '0.875rem', lineHeight: 1.4 }}>
            Continuous alert monitoring isn't live yet. For now, submitting below
            runs a one-time search — your saved searches will become alerts when
            we turn it on.
          </p>
        </div>
      </div>

      <h1 className={styles.pageTitle}>Set Up an Alert</h1>

      <div className={styles.createSection}>
        <h2 className={styles.sectionTitle}>Who should we watch?</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <input
              type="text"
              placeholder="Name (First Last), phone, or email"
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              required
              autoFocus
              className={styles.input}
              style={{ flex: 1 }}
            />
            <button type="submit" className={styles.addBtn}>
              Run search
            </button>
          </div>
        </form>
        {error && (
          <p className={styles.errorMsg} role="alert">{error}</p>
        )}
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
          Tip — use a full name with state for the most accurate results, or paste a 10-digit phone number to look up by phone.
        </p>
      </div>
    </main>
  );
};

export default AlertsPage;
