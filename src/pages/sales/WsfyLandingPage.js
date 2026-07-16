import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { track } from '../../services/trackingService';
import { useSignup } from '../../hooks/useSignup';
import SelfIdentifyCard from '../../components/SelfIdentifyCard';
import US_STATES from './usStates';
import ColorLandingFooter from './ColorLandingFooter';

/**
 * Visitor WSFY funnel — IDENTITY-FIRST (owner 2026-07-16). No search-phrase capture and no separate
 * "create account" screen. We capture the fields needed to MATCH the visitor's own record + their
 * contact info, silently create the account (auto-generated password + login-link email), then run
 * the real identity match + KBA (SelfIdentifyCard) which COMPLETES their profile from their actual
 * record and marks them mapped_identity — then push them into PAYMENT to reveal who's searching.
 * Model: confirm identity → free tease (real mapping info, masked names) → pay to reveal.
 */
const P = { green: '#0d5d2f', greenDark: '#0a4a25', ink: '#0f2533', mut: '#5b7484', line: '#d3e3ec', bg: '#eef6fb', chip: '#eaf3fa' };
const TOTAL_STEPS = 4;
const getStepIndex = (s) => ({ name: 1, location: 2, details: 3, contact: 4 }[s] || 0);

const genPassword = () => {
  const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `Id!${rand.slice(0, 14)}A9`; // length + upper/lower/digit/symbol → passes password rules
};

const WsfyLandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const q = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const { submit: signupSubmit, loading: signingUp } = useSignup();

  const [firstName, setFirstName] = useState(q.get('fn') || q.get('firstName') || '');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState(q.get('ln') || q.get('lastName') || '');
  const [city, setCity] = useState(q.get('city') || '');
  const [state, setState] = useState(q.get('state') || '');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('name');
  const [err, setErr] = useState('');
  const stepIndex = getStepIndex(step);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);
  useEffect(() => { track('wsfy_landing_view', {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goToPayment = () => {
    track('wsfy_identity_confirmed', {});
    navigate('/payment?reason=wsfy');
  };

  const startName = (e) => {
    e.preventDefault(); setErr('');
    if (!firstName.trim() || !lastName.trim()) { setErr('Please enter your first and last name.'); return; }
    track('wsfy_step', { step: 'location' }); setStep('location');
  };
  const continueLocation = () => {
    if (!state.trim()) { setErr('Please select your state.'); return; }
    setErr(''); track('wsfy_step', { step: 'details' }); setStep('details');
  };
  const continueDetails = () => { setErr(''); track('wsfy_step', { step: 'contact' }); setStep('contact'); };

  // Contact step → silently create the account, then run the real identity match (SelfIdentifyCard).
  const createAccountAndIdentify = async () => {
    setErr('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('Please enter a valid email so we can send your results.'); return; }
    track('wsfy_step', { step: 'creating_account' });
    const ok = await signupSubmit({
      email: email.trim(),
      password: genPassword(),
      extraPayload: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        fullName: [firstName, middleName, lastName].filter(Boolean).join(' ').trim(),
        phone: phone.trim() || undefined,
        intent: 'wsfy',
      },
    });
    if (!ok) { setErr('We couldn’t create your account with that email — it may already be in use. Try logging in.'); return; }
    track('wsfy_account_created', {});
    setStep('identify'); // SelfIdentifyCard takes over: match record + KBA + complete the profile
  };

  const input = { width: '100%', boxSizing: 'border-box', padding: '0.85rem 0.95rem', fontSize: '1rem', border: `1.5px solid ${P.line}`, borderRadius: 10, outline: 'none', background: '#fff', color: P.ink };
  const cta = { width: '100%', minHeight: 58, marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.06rem', fontWeight: 800, color: '#fff', background: P.green, border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 8px 20px rgba(13,93,47,0.3)' };
  const btnGhost = { ...cta, minHeight: 46, marginTop: '0.6rem', background: 'transparent', color: P.green, boxShadow: 'none', border: `1.5px solid ${P.green}`, fontSize: '0.95rem', fontWeight: 600 };
  const card = { background: '#fff', border: `1px solid ${P.line}`, borderRadius: 16, padding: '1.6rem 1.5rem', boxShadow: '0 10px 30px rgba(5,90,134,0.10)' };
  const label = { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: P.greenDark, margin: '0 0 0.3rem' };

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 42%)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.75rem 1rem 2.5rem' }}>
        {step === 'name' && (
          <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
            <h1 style={{ margin: 0, fontSize: '2.1rem', lineHeight: 1.12, fontWeight: 800, letterSpacing: '-0.02em', color: P.ink }}>See Who&apos;s Searching For You</h1>
            <p style={{ margin: '0.6rem 0 0', fontSize: '1rem', color: P.mut, lineHeight: 1.5 }}>Confirm your identity to see who&apos;s looking you up — and control what they can find.</p>
          </div>
        )}

        <div style={card}>
          {stepIndex >= 2 && stepIndex <= TOTAL_STEPS && step !== 'identify' && (
            <div style={{ marginBottom: '1.3rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: P.mut }}>Step {stepIndex} of {TOTAL_STEPS}</p>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[1, 2, 3, 4].map((n) => <div key={n} style={{ flex: 1, height: 6, borderRadius: 999, background: n <= stepIndex ? P.green : '#dbe9f2' }} />)}
              </div>
            </div>
          )}

          {step === 'name' && (
            <>
              <ul style={{ listStyle: 'none', margin: '0 0 1.3rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {[['👀', 'See who has searched for your name'], ['📍', 'Where they searched from'], ['🛡️', 'Control what strangers can see about you']].map(([ic, text]) => (
                  <li key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.95rem', lineHeight: 1.4, color: P.ink }}>
                    <span aria-hidden="true" style={{ fontSize: 20, flexShrink: 0 }}>{ic}</span><span>{text}</span>
                  </li>
                ))}
              </ul>
              <form onSubmit={startName} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}><label style={label} htmlFor="wsfy-fn">Your first name</label><input id="wsfy-fn" style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="ex. Jordan" required /></div>
                  <div style={{ flex: 1 }}><label style={label} htmlFor="wsfy-ln">Your last name</label><input id="wsfy-ln" style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="ex. Rivera" required /></div>
                </div>
                {err && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0 }}>{err}</p>}
                <button type="submit" style={cta}>Get started →</button>
              </form>
            </>
          )}

          {step === 'location' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Where do you live?</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut }}>This helps us find your exact record.</p>
              <label style={label} htmlFor="wsfy-state">State</label>
              <select id="wsfy-state" style={{ ...input, marginBottom: '1rem', borderColor: err ? '#b91c1c' : P.line }} value={state} onChange={(e) => { setState(e.target.value); if (err) setErr(''); }}>
                {US_STATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <label style={label} htmlFor="wsfy-city">City (optional)</label>
              <input id="wsfy-city" style={{ ...input, marginBottom: '1rem' }} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              {err && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{err}</p>}
              <button type="button" style={cta} onClick={continueLocation}>Continue</button>
            </div>
          )}

          {step === 'details' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>A few details about you</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut }}>Age and middle name pin down the right record.</p>
              <label style={label} htmlFor="wsfy-age">Your age (optional)</label>
              <input id="wsfy-age" style={{ ...input, marginBottom: '0.75rem' }} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
              <label style={label} htmlFor="wsfy-mid">Middle name (optional)</label>
              <input id="wsfy-mid" style={{ ...input, marginBottom: '1rem' }} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name" />
              <button type="button" style={cta} onClick={continueDetails}>Continue</button>
            </div>
          )}

          {step === 'contact' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Where should we send your results?</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut }}>We&apos;ll create your account and email you a secure login link — no password to remember.</p>
              <label style={label} htmlFor="wsfy-email">Email</label>
              <input id="wsfy-email" type="email" style={{ ...input, marginBottom: '0.75rem', borderColor: err ? '#b91c1c' : P.line }} value={email} onChange={(e) => { setEmail(e.target.value); if (err) setErr(''); }} placeholder="you@example.com" required />
              <label style={label} htmlFor="wsfy-phone">Mobile (optional — for alerts)</label>
              <input id="wsfy-phone" type="tel" style={{ ...input, marginBottom: '1rem' }} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
              {err && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{err}</p>}
              <button type="button" style={cta} onClick={createAccountAndIdentify} disabled={signingUp}>
                {signingUp ? 'Setting up…' : 'Confirm my identity →'}
              </button>
              <p style={{ margin: '0.9rem 0 0', fontSize: '0.78rem', color: P.mut, textAlign: 'center', lineHeight: 1.5 }}>
                By continuing you agree to our Terms &amp; Privacy Policy. We only use your info to match your record and show who&apos;s searching for you.
              </p>
            </div>
          )}

          {/* The real match + KBA — completes the profile from the actual record and marks them
              mapped_identity, then routes into payment for the reveal. */}
          {step === 'identify' && (
            <div>
              <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.3rem', fontWeight: 800, color: P.ink }}>Confirm your identity</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut }}>We found records matching your details. Confirm which one is you to unlock who&apos;s searching for you.</p>
              <SelfIdentifyCard
                forceShow
                autoStart
                prefill={{ firstName, lastName, city, state, age }}
                onComplete={goToPayment}
              />
            </div>
          )}
        </div>
      </div>
      <ColorLandingFooter bg={P.greenDark} fg="rgba(255,255,255,0.78)" accent="#bbf7d0" />
    </main>
  );
};

export default WsfyLandingPage;
