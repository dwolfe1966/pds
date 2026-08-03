import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import { useBrand } from '../../services/brand';

// Phone landing v1 — the reframed reverse-lookup experience (2026-07-24). A phone number is high-precision
// (one number → one owner), so this leads with a confident single-answer promise and hands off to a
// SINGLE-OWNER reveal (see PhoneSearchResultsPage, gated on the `phoneReveal` flag) instead of a match list.
// Copy is HONEST about what we have today: owner name/age, addresses, relatives, public records — NOT
// carrier/line-type/spam (we have no phone-intelligence provider yet; those slot in later, see
// docs/design/phone-funnel-improvements.md).
const GREEN = '#0d5d2f';

const VALUE = [
  ['👤', "Owner's name & age"],
  ['📍', 'Address history'],
  ['👪', 'Relatives & associates'],
  ['⚖️', 'Booking & court records'],
];

const formatPhone = (d) => {
  if (!d) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
};

export default function PhoneSearchLandingV1Page() {
  const brand = useBrand();
  useLandingTrack('phone', 'v1');
  const navigate = useNavigate();
  const [digits, setDigits] = useState('');
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');

  // Signal the results page to use the single-owner reveal (vs the legacy match-list SRP). Clear the P2
  // safety flag so a prior "is this call safe?" session doesn't leak its panel (and Twilio cost) onto v1.
  useEffect(() => { try { sessionStorage.setItem('phoneReveal', '1'); sessionStorage.removeItem('phoneSafety'); } catch { /* ignore */ } }, []);

  const onChange = (e) => { setDigits(e.target.value.replace(/\D/g, '').slice(0, 10)); if (err) setErr(''); };

  const submit = (e) => {
    e.preventDefault();
    if (digits.length !== 10) { setErr('Please enter a 10-digit phone number.'); track('validation_error', { reason: 'phone_invalid', variant: 'v1' }); return; }
    if (!agree) { setErr('Please agree to the terms to continue.'); track('validation_error', { reason: 'fcra_not_agreed', variant: 'v1' }); return; }
    track('search_step', { step: 'final-search', search_type: 'phone', variant: 'v1' });
    track('fcra_agree', { search_type: 'phone', variant: 'v1' });
    navigate(`/phone/loader?phone=${encodeURIComponent(digits)}`);
  };

  return (
    <main style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
        <a href="/" style={{ fontWeight: 800, color: GREEN, textDecoration: 'none', fontSize: 18 }}>{brand.name}</a>
      </header>

      <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', padding: '28px 18px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>📞</div>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#111827', margin: '0 0 8px', lineHeight: 1.2 }}>
            Find Out Who Owns Any Number
          </h1>
          <p style={{ fontSize: 15, color: '#6b7280', margin: 0, lineHeight: 1.55 }}>
            Enter a phone number and we'll identify the owner — name, location, and public records tied to the line.
          </p>
        </div>

        <form onSubmit={submit} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <label htmlFor="phone-v1" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Phone number</label>
          <input
            id="phone-v1"
            type="tel"
            inputMode="tel"
            value={formatPhone(digits)}
            onChange={onChange}
            placeholder="(555) 123-4567"
            style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', fontSize: 18, border: `1px solid ${err ? '#dc2626' : '#d1d5db'}`, borderRadius: 10, outline: 'none', letterSpacing: '0.02em' }}
          />
          {err && <p style={{ color: '#dc2626', fontSize: 13, margin: '8px 0 0' }}>{err}</p>}

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '14px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>I understand this is not a consumer report and may not be used for employment, tenant, credit, or other FCRA-covered decisions.</span>
          </label>

          <button type="submit" style={{ width: '100%', marginTop: 16, padding: '15px', fontSize: 17, fontWeight: 800, color: '#fff', background: GREEN, border: 'none', borderRadius: 10, cursor: 'pointer' }}>
            🔍 Search This Number
          </button>
        </form>

        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '18px 20px', marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 10px' }}>What you may find</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px' }}>
            {VALUE.map(([ic, label]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151' }}>
                <span aria-hidden="true">{ic}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
          🔒 Secure &amp; encrypted. All data from publicly available sources.
        </p>
      </div>
    </main>
  );
}
