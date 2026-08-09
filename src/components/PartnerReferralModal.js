import React, { useState } from 'react';
import { getMappedIdentity, submitPartnerReferral } from '../services/memberEnrichment';

const GREEN = '#0d5d2f';

// Rung 5 — records that need a legal/financial remedy, not an opt-out form. Two honest halves:
//   1) "Start now — free": real, official self-serve first steps the member can take TODAY (no partner needed).
//   2) "Get matched": consented interest capture for our vetted-partner network AS IT LAUNCHES. We do NOT yet
//      have live partners (owner-gated: vetted partners + revenue terms + legal review), so we DON'T promise
//      someone will call — we honestly frame it as joining the list. IDLookup doesn't give legal/credit advice.
const TRACKS = {
  expungement: {
    title: 'Expungement & record sealing', partner: 'attorney',
    blurb: 'Some court and criminal records can be expunged or sealed — they can’t just be opted out of. Eligibility and process depend on your state.',
    selfServe: [
      { label: 'Check if your record can be cleared', url: 'https://www.usa.gov/expunge-criminal-record', note: 'USA.gov — how expungement works and where to start, by state.' },
      { label: 'Find free legal aid near you', url: 'https://www.lawhelp.org/', note: 'Free/low-cost legal help finder — many areas have expungement clinics.' },
    ],
    prep: ['The record(s) you want addressed', 'The state/county they’re in', 'Basic case details (dates, charges, dispositions)'],
  },
  credit: {
    title: 'Credit remediation', partner: 'credit specialist',
    blurb: 'Your credit file can’t be deleted, but inaccuracies can be disputed and fixed — much of it you can do yourself for free.',
    selfServe: [
      { label: 'Get your 3 credit reports free', url: 'https://www.annualcreditreport.com', note: 'The only federally authorized free source — check all three bureaus.' },
      { label: 'Dispute errors (CFPB guide)', url: 'https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/', note: 'Free step-by-step from the government — you don’t have to pay anyone to dispute.' },
      { label: 'Stop prescreened offers', url: 'https://www.optoutprescreen.com', note: 'Cuts a common source of credit-based junk mail.' },
    ],
    prep: ['Which bureau / what’s wrong', 'A recent copy of your credit report'],
  },
  identity_theft: {
    title: 'Identity theft recovery', partner: 'recovery specialist',
    blurb: 'If someone has used your identity, there’s a free official recovery process — and a specialist can help with the hardest cases.',
    selfServe: [
      { label: 'Build your recovery plan (IdentityTheft.gov)', url: 'https://www.identitytheft.gov', note: 'The FTC’s official, free step-by-step recovery plan and affidavit.' },
      { label: 'Freeze your credit at all 3 bureaus', url: 'https://www.usa.gov/credit-freeze', note: 'Stops new fraudulent accounts — see the Foundational sources above.' },
    ],
    prep: ['What was compromised (accounts, SSN, cards)', 'Any fraudulent activity you’ve spotted', 'Dates you noticed it'],
  },
  defamation: {
    title: 'False or harmful content', partner: 'defamation attorney',
    blurb: 'False, defamatory, or harmful content about you online may be removable — sometimes by request, sometimes only with legal help.',
    selfServe: [
      { label: 'Request removal from Google', url: 'https://support.google.com/websearch/troubleshooter/9685456', note: 'Google’s own removal tools for personal info, doxxing, and some harmful results.' },
      { label: 'Report content to the platform', url: 'https://www.usa.gov/social-media-scams', note: 'Most platforms have a report/removal path for harassment and impersonation.' },
    ],
    prep: ['Links (URLs) to the content', 'Why it’s false or harmful', 'Any proof you have'],
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
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, maxWidth: 520, width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef2f0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, position: 'sticky', top: 0, background: '#fff', borderRadius: '16px 16px 0 0' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>{cfg.title}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '18px 22px' }}>
          {done ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: GREEN, marginBottom: 6 }}>✓ You’re on the list</div>
              <p style={{ fontSize: 13.5, color: '#4b5563', lineHeight: 1.55, margin: 0 }}>We’ll match you with a vetted {cfg.partner} as our partner network launches, and reach out to {contact} then. No obligation, and we’ll only share what you approved. In the meantime, the free steps above are the fastest way to start.</p>
              <button type="button" onClick={onClose} style={{ ...btn, marginTop: 16 }}>Done</button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.55, margin: '0 0 14px' }}>{cfg.blurb}</p>

              {/* 1) Start now — free official steps the member can act on today */}
              <div style={{ fontSize: 12, fontWeight: 800, color: GREEN, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Start now — free</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                {cfg.selfServe.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', border: '1px solid #d1fae5', background: '#f0fdf4', borderRadius: 10, padding: '10px 12px', textDecoration: 'none' }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: GREEN }}>{s.label} →</span>
                    {s.note && <span style={{ display: 'block', fontSize: 12, color: '#4b5563', marginTop: 2, lineHeight: 1.45 }}>{s.note}</span>}
                  </a>
                ))}
              </div>

              {/* 2) Get matched — honest waitlist for the vetted-partner network (no false "we'll call you now") */}
              <div style={{ borderTop: '1px solid #eef2f0', paddingTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 4 }}>Want a specialist to handle it?</div>
                <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.5, margin: '0 0 8px' }}>
                  We’re building a network of vetted {cfg.partner}s. Add your name and we’ll match you as it
                  launches — this is a <strong>referral</strong>, not legal or credit advice, and there’s no obligation.
                </p>
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>They’d need: {cfg.prep.join(' · ')}.</div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: '#374151', lineHeight: 1.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>Match me with a vetted {cfg.partner} when available, and share my details ({contact}) so they can reach me.</span>
                </label>
                <button type="button" onClick={submit} disabled={!agree || busy} style={{ ...btn, marginTop: 14, opacity: (!agree || busy) ? 0.55 : 1, cursor: (!agree || busy) ? 'not-allowed' : 'pointer' }}>
                  {busy ? 'Adding you…' : 'Add me to the list'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const btn = { background: GREEN, color: '#fff', border: 'none', borderRadius: 9, padding: '11px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer' };
