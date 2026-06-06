import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Opt-out option for partner traffic configured with `optout: "yes"`
 * (campaign.optOut). Lets a person whose record appears in results request
 * removal via the opt-out portal. Render gated on `campaign?.optOut`.
 */
export default function OptOutNotice({ style }) {
  return (
    <div
      role="note"
      style={{
        background: '#f8fafc',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '0.6rem 0.9rem',
        margin: '0 0 1rem',
        fontSize: '0.85rem',
        color: '#475569',
        textAlign: 'center',
        ...style,
      }}
    >
      Is this your information?{' '}
      <Link to="/opt-out" style={{ color: '#0d5d2f', fontWeight: 600, textDecoration: 'underline' }}>
        Request removal / opt out
      </Link>
    </div>
  );
}
