import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import SignalTeaser from '../../components/SignalTeaser';
import { track } from '../../services/trackingService';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useBrand } from '../../services/brand';

// P3 — "Reverse your OWN number" exposure funnel (2026-07-24). Net-new angle no competitor runs:
// instead of "who owns this stranger's number," lead with "your number is exposed — see what strangers
// can find, and who's been searching for you." It's a low-friction, phone-first FRONT DOOR to the
// existing WSFY convert engine (WsfyLandingPage: phone-match → KBA confirm → account → paid reveal).
// One number → one owner → them, so the exposure teaser is theirs. Honest loader + owner-self severity
// ordering (SignalTeaser), never fabricated counts. See project_phone_email_flow_roadmap.
const P = { green: '#0d5d2f', greenDark: '#0a4a25', ink: '#0f2533', mut: '#5b7484', line: '#d3e3ec', warn: '#b45309', warnBg: '#fffbeb' };

function ownerSubject(r) {
  const parts = String(r?.fullName || '').trim().split(/\s+/);
  const loc = String(r?.location || '').split(',').map((s) => s.trim());
  const age = (String(r?.ageRange || r?.age || '').match(/\d+/) || [])[0];
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '', city: loc[0] || '', state: loc[1] || '', age };
}
function maskName(name = '') {
  return String(name).trim().split(/\s+/).map((p) => (p.length <= 1 ? p : `${p[0]}${'•'.repeat(Math.max(2, p.length - 1))}`)).join(' ');
}
const formatPhone = (d) => {
  if (!d) return '';
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
};

// What the honest loader is actually checking — real sources, no fake "scanning millions of records".
const LOADER_LINES = ['public records', 'address history', 'relatives & associates', 'incarceration records', 'search activity on your number'];

export default function PhoneExposureLandingPage() {
  const brand = useBrand();
  useLandingTrack('phone-exposure', 'v1');
  const navigate = useNavigate();
  const [digits, setDigits] = useState('');
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [step, setStep] = useState('input'); // input | searching | reveal | none
  const [owner, setOwner] = useState(null);
  const [others, setOthers] = useState(0);

  const onChange = (e) => { setDigits(e.target.value.replace(/\D/g, '').slice(0, 10)); if (err) setErr(''); };

  const run = async (e) => {
    e.preventDefault();
    if (digits.length !== 10) { setErr('Please enter a 10-digit phone number.'); return; }
    if (!agree) { setErr('Please agree to continue.'); return; }
    setErr(''); setStep('searching');
    track('exposure_search', { type: 'phone', variant: 'v1' });
    try {
      const resp = await api.searchPeople({ phone: digits, type: 'phone', source: 'phone-exposure' });
      const list = resp?.data || [];
      track('exposure_result', { type: 'phone', found: list.length });
      if (list.length) { setOwner(list[0]); setOthers(Math.max(list.length - 1, 0)); setStep('reveal'); }
      else { setStep('none'); }
    } catch { setStep('none'); }
  };

  // Claim → hand into the WSFY convert engine with the number prefilled (it confirms identity + converts).
  const claim = () => {
    track('exposure_claim', { type: 'phone' });
    navigate(`/see-who?phone=${encodeURIComponent(digits)}`);
  };

  const cta = { width: '100%', minHeight: 56, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: '1.05rem', fontWeight: 800, color: '#fff', background: P.green, border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 8px 20px rgba(13,93,47,0.3)' };
  const card = { background: '#fff', border: `1px solid ${P.line}`, borderRadius: 16, padding: '1.5rem 1.4rem', boxShadow: '0 10px 30px rgba(5,90,134,0.10)' };

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 42%)' }}>
      <header style={{ borderBottom: `1px solid ${P.line}`, background: 'rgba(255,255,255,0.85)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontWeight: 800, color: P.green, fontSize: '1.05rem' }}>{brand.name}</span>
          <a href="/who-is-searching" style={{ color: P.green, fontWeight: 700, fontSize: '0.86rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>Already a member? →</a>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.75rem 1rem 2.5rem' }}>
        {step === 'input' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1.3rem' }}>
              <div style={{ fontSize: 40, marginBottom: 6 }}>📵</div>
              <h1 style={{ margin: 0, fontSize: '2rem', lineHeight: 1.14, fontWeight: 800, letterSpacing: '-0.02em', color: P.ink }}>Is Your Phone Number Exposed?</h1>
              <p style={{ margin: '0.6rem 0 0', fontSize: '1rem', color: P.mut, lineHeight: 1.5 }}>
                Enter your number to see what strangers can find about you online — and whether anyone&apos;s been searching for you.
              </p>
            </div>
            <div style={card}>
              <form onSubmit={run}>
                <label htmlFor="exp-phone" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: P.greenDark, marginBottom: 6 }}>Your phone number</label>
                <input id="exp-phone" type="tel" inputMode="tel" value={formatPhone(digits)} onChange={onChange} placeholder="(555) 123-4567"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', fontSize: 18, border: `1.5px solid ${err ? '#dc2626' : P.line}`, borderRadius: 10, outline: 'none', letterSpacing: '0.02em' }} />
                {err && <p style={{ color: '#dc2626', fontSize: 13, margin: '8px 0 0' }}>{err}</p>}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '14px 0 0', fontSize: 12, color: P.mut, lineHeight: 1.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>I understand this is not a consumer report and may not be used for employment, tenant, credit, or other FCRA-covered decisions.</span>
                </label>
                <button type="submit" style={{ ...cta, marginTop: 16 }}>🔍 Check My Exposure</button>
              </form>
            </div>
            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
              🔒 Private — no one is notified. We&apos;ll show you what&apos;s public and how to lock it down.
            </p>
          </>
        )}

        {step === 'searching' && (
          <div style={{ ...card, textAlign: 'center', padding: '2.25rem 1.4rem' }}>
            <div style={{ width: 46, height: 46, border: `4px solid #eef6fb`, borderTopColor: P.green, borderRadius: '50%', margin: '0 auto 1.1rem', animation: 'spin 0.8s linear infinite' }} />
            <h2 style={{ margin: '0 0 0.9rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Checking what&apos;s public about your number…</h2>
            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
              {LOADER_LINES.map((l) => (
                <span key={l} style={{ fontSize: 13, color: P.mut }}>✓ {l}</span>
              ))}
            </div>
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          </div>
        )}

        {step === 'reveal' && owner && (
          <div>
            <div style={{ background: P.warnBg, border: '1px solid #fde68a', borderRadius: 12, padding: '0.85rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{ fontSize: 20 }}>⚠️</span>
              <span style={{ fontSize: '0.92rem', color: P.warn, fontWeight: 700, lineHeight: 1.4 }}>Your number is exposed. Here&apos;s what strangers can find:</span>
            </div>
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.9rem' }}>
                <span style={{ width: 48, height: 48, borderRadius: '50%', background: '#f0fdf4', color: P.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>👤</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.75rem', color: P.mut, textTransform: 'uppercase', letterSpacing: '0.04em' }}>This number is tied to</div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: P.ink, filter: 'blur(4px)', userSelect: 'none', marginTop: 2 }}>{maskName(owner.fullName)}</div>
                  <div style={{ fontSize: '0.85rem', color: P.mut, marginTop: 2 }}>{owner.location || ''}{(owner.age || owner.ageRange) ? ` · Age ${owner.age || owner.ageRange}` : ''}</div>
                </div>
              </div>
              {/* Exposure teaser — owner-self lens orders real signals by severity (records, relatives, etc.). */}
              <SignalTeaser subject={ownerSubject(owner)} flow="general" viewerRelation="owner-self" stage="pre-signup" />
              {/* WSFY tease — capability-framed, NOT a fabricated count. */}
              <div style={{ marginTop: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span aria-hidden="true" style={{ fontSize: 20 }}>👀</span>
                <span style={{ fontSize: '0.9rem', color: '#14532d', fontWeight: 700, lineHeight: 1.4 }}>See who&apos;s been searching for you — and remove yourself from public results.</span>
              </div>
              <button type="button" onClick={claim} style={{ ...cta, marginTop: '1.1rem' }}>This is my number — show me everything →</button>
              <p style={{ margin: '0.8rem 0 0', fontSize: '0.78rem', color: P.mut, textAlign: 'center', lineHeight: 1.5 }}>
                Confirm it&apos;s you to reveal the full exposure report, see who&apos;s searching, and control what&apos;s public.
              </p>
            </div>
          </div>
        )}

        {step === 'none' && (
          <div style={card}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>We couldn&apos;t match that number to a public record</h2>
              <p style={{ margin: '0 0 1.1rem', fontSize: '0.92rem', color: P.mut, lineHeight: 1.55 }}>
                That&apos;s not a guarantee you&apos;re not exposed elsewhere. Claim your identity to monitor what&apos;s public about you and see who&apos;s searching for you.
              </p>
              <button type="button" onClick={() => navigate('/see-who')} style={cta}>Check my full identity exposure →</button>
              <button type="button" onClick={() => { setStep('input'); setDigits(''); setAgree(false); }} style={{ marginTop: 12, background: 'none', border: 'none', color: P.green, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Try another number</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
