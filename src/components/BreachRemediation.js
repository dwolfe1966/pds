import React, { useState } from 'react';

const GREEN = '#0d5d2f';

// Turn a breach ALERT into a fix. A breach isn't an opt-out (you can't un-leak a password) — the remedy is to
// change the password everywhere it was used and lock the account down. We can't do that for you, so this is
// honest step-by-step guidance + a self-reported "I've secured this". `item` is a breach node row from the
// footprint (name = the breached service; node.data_types = what leaked, when known).
const dataLabel = (t) => ({
  email: 'email addresses', password: 'passwords', username: 'usernames', phone: 'phone numbers',
  address: 'addresses', dob: 'dates of birth', ssn: 'Social Security numbers', ip: 'IP addresses',
  name: 'names', card: 'payment cards',
}[t] || t);

export default function BreachRemediation({ item, onClose, onSecured }) {
  const [busy, setBusy] = useState(false);
  const name = (item && item.name) || 'this site';
  const leaked = (item && item.node && Array.isArray(item.node.data_types) ? item.node.data_types : []).filter(Boolean);
  const leakedPassword = leaked.length === 0 || leaked.includes('password');

  const steps = [
    { t: `Change your password on ${name}`, d: 'Set a new, unique password you use nowhere else.' },
    { t: 'Change it anywhere you reused it', d: 'A leaked password is tried against your other accounts (email, bank). Update every site that shared it.' },
    { t: 'Turn on two-factor authentication', d: 'Even a stolen password can’t get in without your second factor. Enable it on this account and your email.' },
    { t: 'Use a password manager going forward', d: 'It makes every login unique automatically, so one breach can’t spread.' },
  ];
  if (!leakedPassword) steps[0] = { t: `Review your ${name} account`, d: 'Watch for suspicious activity, and update your password + 2FA as a precaution.' };

  const secure = async () => { setBusy(true); try { await (onSecured && onSecured(item)); } finally { setBusy(false); onClose && onClose(); } };

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 500, width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef2f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>Secure your {name} breach</div>
            <div style={{ fontSize: 12.5, color: '#4b5563', marginTop: 3 }}>
              {leaked.length ? <>Exposed here: <b>{leaked.map(dataLabel).join(', ')}</b>.</> : 'Your email turned up in this known breach.'}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ flexShrink: 0, border: 'none', background: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          <p style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.55, margin: '0 0 14px' }}>
            A breach can’t be “removed” — the data’s already out. What protects you is closing the door it opens:
          </p>
          <ol style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 10 }}>
                <span aria-hidden="true" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: '#f0fdf4', border: '1px solid #bbf7d0', color: GREEN, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <span>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{s.t}</span>
                  <span style={{ display: 'block', fontSize: 12.5, color: '#4b5563', lineHeight: 1.45, marginTop: 1 }}>{s.d}</span>
                </span>
              </li>
            ))}
          </ol>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button type="button" onClick={secure} disabled={busy}
              style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 9, padding: '11px 18px', fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
              {busy ? 'Saving…' : "I've secured this"}
            </button>
            <button type="button" onClick={onClose} style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 9, padding: '11px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Later</button>
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>
            We can’t change your passwords for you — this is your checklist. We’ll keep watching your email for new breaches.
          </p>
        </div>
      </div>
    </div>
  );
}
