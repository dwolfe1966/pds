import React, { useState } from 'react';
import { getMappedIdentity, submitPartnerReferral } from '../services/memberEnrichment';

const GREEN = '#0d5d2f';

// Rung 5 — connect to a vetted partner for records that need a legal/financial remedy, not an opt-out form.
// Referral only: IDLookup doesn't provide legal or credit advice. Contact details come from the mapped
// identity (no re-capturing PII); the member confirms + consents to the handoff.
const TRACKS = {
  expungement: {
    title: 'Expungement & record sealing',
    blurb: 'Some court and criminal records can be expunged or sealed — they can’t just be opted out of. A vetted attorney can tell you if you qualify and handle the filing.',
    partner: 'attorney',
    prep: ['The record(s) you want addressed', 'The state/county they’re in', 'Basic case details (dates, charges, dispositions)'],
  },
  credit: {
    title: 'Credit remediation',
    blurb: 'Your credit file can’t be deleted, but a vetted credit specialist can dispute inaccuracies and help you rebuild it.',
    partner: 'credit specialist',
    prep: ['Which bureau / what’s wrong', 'A recent copy of your credit report'],
  },
};

export default function PartnerReferralModal({ track, onClose }) {
  const cfg = TRACKS[track] || TRACKS.expungement;
  const id = getMappedIdentity() || {};
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  let email = id.email;
  try { if (!email) { const u = JSON.parse(localStorage.getItem('user') || 'null'); email = u && u.email; } } catch { /* ignore */ }
  const contact = [id.name, email].filter(Boolean).join(' · ') || 'your account details';

  const submit = async () => {
    setBusy(true);
    const res = await submitPartnerReferral({ track, name: id.name, email, phone: id.phone, state: id.state, context: { source: 'footprint' }, consent: true });
    setBusy(false);
    if (res && res.ok) setDone(true);
  };

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 500, width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef2f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>{cfg.title}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          {done ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: GREEN, marginBottom: 6 }}>✓ Request received</div>
              <p style={{ fontSize: 13.5, color: '#4b5563', lineHeight: 1.55, margin: 0 }}>A vetted {cfg.partner} will reach out to {contact}. There’s no obligation, and we’ll only share what you approved.</p>
              <button type="button" onClick={onClose} style={{ ...btn, marginTop: 16 }}>Done</button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.55, margin: '0 0 12px' }}>{cfg.blurb}</p>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>What they’ll need</div>
              <ul style={{ margin: '0 0 14px', paddingLeft: 18 }}>
                {cfg.prep.map((s, i) => <li key={i} style={{ fontSize: 13, color: '#4b5563', marginBottom: 4 }}>{s}</li>)}
              </ul>
              <div style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 12 }}>We’ll share your contact details ({contact}) so they can reach you.</div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#374151', lineHeight: 1.5, cursor: 'pointer' }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
                <span>I’d like a vetted {cfg.partner} to contact me and I consent to sharing these details. I understand this is a <strong>referral</strong> — IDLookup doesn’t provide legal or credit advice, and there’s no obligation.</span>
              </label>
              <button type="button" onClick={submit} disabled={!agree || busy} style={{ ...btn, marginTop: 16, opacity: (!agree || busy) ? 0.55 : 1, cursor: (!agree || busy) ? 'not-allowed' : 'pointer' }}>
                {busy ? 'Sending…' : `Connect me with a ${cfg.partner}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const btn = { background: GREEN, color: '#fff', border: 'none', borderRadius: 9, padding: '11px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer' };
