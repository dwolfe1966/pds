import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEmailExposure } from '../../services/emailExposureService';
import { track } from '../../services/trackingService';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useBrand } from '../../services/brand';

// E3 — "Is your email exposed?" breach-check funnel (2026-07-25). The email sibling of P3: a SELF-CHECK
// (enter YOUR email) that turns breach anxiety (HIBP) into the identity-management/WSFY funnel. Breach
// summary + exposed-data classes are the alarming free hook; the breach NAMES + a removal plan are the
// gated payoff → hand into the WSFY convert engine (/see-who?email=). See project_phone_email_flow_roadmap.
const P = { green: '#0d5d2f', greenDark: '#0a4a25', ink: '#0f2533', mut: '#5b7484', line: '#d3e3ec', warn: '#b45309', warnBg: '#fffbeb', danger: '#b91c1c', dangerBg: '#fef2f2' };

const CLASS_ICON = {
  Passwords: '🔑', 'Historical passwords': '🔑', 'Password hints': '🔑',
  'Phone numbers': '📞', 'Physical addresses': '🏠', 'Email addresses': '✉️',
  'Credit cards': '💳', 'Partial credit card data': '💳', 'Bank account numbers': '🏦',
  'Social security numbers': '🆔', 'Names': '👤', 'Dates of birth': '🎂', 'Geographic locations': '📍',
  'Security questions and answers': '❓', 'IP addresses': '🌐', 'Usernames': '👤', 'Genders': '⚧',
};
const classIcon = (c) => CLASS_ICON[c] || '⚠️';

const LOADER_LINES = ['known data breaches', 'leaked credential dumps', 'exposed personal data'];

export default function EmailExposureLandingPage() {
  const brand = useBrand();
  useLandingTrack('email-exposure', 'v1');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [step, setStep] = useState('input'); // input | checking | reveal | clean
  const [res, setRes] = useState(null);

  const run = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('Please enter a valid email address.'); return; }
    if (!agree) { setErr('Please agree to continue.'); return; }
    setErr(''); setStep('checking');
    track('exposure_search', { type: 'email', variant: 'v1' });
    const r = await fetchEmailExposure(email.trim());
    track('exposure_result', { type: 'email', breached: !!r.breached, count: r.count || 0, available: !!r.available });
    setRes(r);
    // If HIBP is unavailable (key unset / error), skip the alarm and route to the identity check.
    if (!r.available) { navigate(`/see-who?email=${encodeURIComponent(email.trim())}`); return; }
    setStep(r.breached ? 'reveal' : 'clean');
  };

  const secure = () => {
    track('exposure_claim', { type: 'email', breached: !!(res && res.breached) });
    navigate(`/see-who?email=${encodeURIComponent(email.trim())}`);
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
              <div style={{ fontSize: 40, marginBottom: 6 }}>🔓</div>
              <h1 style={{ margin: 0, fontSize: '2rem', lineHeight: 1.14, fontWeight: 800, letterSpacing: '-0.02em', color: P.ink }}>Is Your Email Exposed?</h1>
              <p style={{ margin: '0.6rem 0 0', fontSize: '1rem', color: P.mut, lineHeight: 1.5 }}>
                Check your email against known data breaches — see what&apos;s been leaked, and lock down what strangers can find about you.
              </p>
            </div>
            <div style={card}>
              <form onSubmit={run}>
                <label htmlFor="exp-email" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: P.greenDark, marginBottom: 6 }}>Your email address</label>
                <input id="exp-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); if (err) setErr(''); }} placeholder="you@email.com"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', fontSize: 18, border: `1.5px solid ${err ? '#dc2626' : P.line}`, borderRadius: 10, outline: 'none' }} />
                {err && <p style={{ color: '#dc2626', fontSize: 13, margin: '8px 0 0' }}>{err}</p>}
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '14px 0 0', fontSize: 12, color: P.mut, lineHeight: 1.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>I understand this is not a consumer report and may not be used for employment, tenant, credit, or other FCRA-covered decisions.</span>
                </label>
                <button type="submit" style={{ ...cta, marginTop: 16 }}>🔎 Check My Email</button>
              </form>
            </div>
            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 16, lineHeight: 1.5 }}>
              🔒 Private — we check your email against public breach databases. We never post or share it.
            </p>
          </>
        )}

        {step === 'checking' && (
          <div style={{ ...card, textAlign: 'center', padding: '2.25rem 1.4rem' }}>
            <div style={{ width: 46, height: 46, border: `4px solid #eef6fb`, borderTopColor: P.green, borderRadius: '50%', margin: '0 auto 1.1rem', animation: 'spin 0.8s linear infinite' }} />
            <h2 style={{ margin: '0 0 0.9rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Checking breach databases…</h2>
            <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
              {LOADER_LINES.map((l) => <span key={l} style={{ fontSize: 13, color: P.mut }}>✓ {l}</span>)}
            </div>
            <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          </div>
        )}

        {step === 'reveal' && res && (
          <div>
            <div style={{ background: P.dangerBg, border: '1px solid #fecaca', borderRadius: 12, padding: '0.95rem 1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span aria-hidden="true" style={{ fontSize: 24 }}>⚠️</span>
              <span style={{ fontSize: '1rem', color: P.danger, fontWeight: 800, lineHeight: 1.3 }}>
                Your email was found in {res.count} data breach{res.count === 1 ? '' : 'es'}.
              </span>
            </div>
            <div style={card}>
              {res.topDataClasses && res.topDataClasses.length > 0 && (
                <>
                  <p style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 800, color: P.ink, textTransform: 'uppercase', letterSpacing: '0.04em' }}>What was exposed</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1rem' }}>
                    {res.topDataClasses.slice(0, 6).map((c) => (
                      <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 700, color: '#7f1d1d', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 999, padding: '5px 11px' }}>
                        {classIcon(c)} {c}
                      </span>
                    ))}
                  </div>
                </>
              )}
              {/* Gated payoff: which breaches (blurred) + a removal plan → convert into the identity funnel. */}
              <p style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 800, color: P.ink, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Which breaches</p>
              <div style={{ display: 'grid', gap: 6, marginBottom: '0.5rem' }}>
                {res.breaches.slice(0, 4).map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: '#374151' }}>
                    <span aria-hidden="true">🔓</span>
                    <span style={{ filter: 'blur(5px)', userSelect: 'none', fontWeight: 700, color: P.ink }}>{b.name}</span>
                    {b.date && <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: P.mut }}>{String(b.date).slice(0, 4)}</span>}
                  </div>
                ))}
                {res.count > 4 && <div style={{ fontSize: '0.82rem', color: P.mut }}>+ {res.count - 4} more</div>}
              </div>
              <div style={{ marginTop: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '0.9rem 1rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span aria-hidden="true" style={{ fontSize: 20 }}>🛡️</span>
                <span style={{ fontSize: '0.9rem', color: '#14532d', fontWeight: 700, lineHeight: 1.4 }}>See which breaches, who&apos;s searching for you, and get a removal plan.</span>
              </div>
              <button type="button" onClick={secure} style={{ ...cta, marginTop: '1.1rem' }}>Secure my identity →</button>
            </div>
          </div>
        )}

        {step === 'clean' && (
          <div style={card}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>No known breaches for this email</h2>
              <p style={{ margin: '0 0 1.1rem', fontSize: '0.92rem', color: P.mut, lineHeight: 1.55 }}>
                Good news — we didn&apos;t find this email in a known breach. But breach data isn&apos;t the whole picture: claim your identity to see what&apos;s public about you and who&apos;s been searching for you.
              </p>
              <button type="button" onClick={secure} style={cta}>Check my full identity exposure →</button>
              <button type="button" onClick={() => { setStep('input'); setEmail(''); setAgree(false); }} style={{ marginTop: 12, background: 'none', border: 'none', color: P.green, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>Check another email</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
