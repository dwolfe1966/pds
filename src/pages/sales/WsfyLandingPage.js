import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { track } from '../../services/trackingService';
import { fetchWhoIsSearching } from '../../services/wsfyClient';
import US_STATES from './usStates';
import ColorLandingFooter from './ColorLandingFooter';

/**
 * Visitor WSFY funnel — mimics the /name/landing/v3 multi-step wizard, but the visitor enters THEIR
 * OWN identity and the payoff is "who's searching for YOU". Steps: your name → location → details →
 * confirm → reveal teaser (real masked count from the corpus) → sign up to see who. The actual
 * identity-verification gate (KBA) + reveal happen after signup (see the member WSFY surfaces).
 */
const P = { green: '#0d5d2f', greenDark: '#0a4a25', ink: '#0f2533', mut: '#5b7484', line: '#d3e3ec', bg: '#eef6fb', chip: '#eaf3fa', orange: '#fd6f0b' };
const TOTAL_STEPS = 4;
const getStepIndex = (s) => ({ name: 1, location: 2, details: 3, confirm: 4 }[s] || 0);

const WsfyLandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const q = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [firstName, setFirstName] = useState(q.get('fn') || q.get('firstName') || '');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState(q.get('ln') || q.get('lastName') || '');
  const [city, setCity] = useState(q.get('city') || '');
  const [state, setState] = useState(q.get('state') || '');
  const [age, setAge] = useState('');
  const [step, setStep] = useState('name');
  const [agree, setAgree] = useState(false);
  const [nameError, setNameError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [agreeError, setAgreeError] = useState('');
  const [reveal, setReveal] = useState(null); // { count, lines[] }
  const stepIndex = getStepIndex(step);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);
  useEffect(() => { track('wsfy_landing_view', {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Interstitial → next-step timers (mirrors the v3 "searching…" beats).
  useEffect(() => {
    let t;
    if (step === 'searching-one') t = setTimeout(() => { track('wsfy_step', { step: 'location' }); setStep('location'); }, 3500);
    if (step === 'searching-two') t = setTimeout(() => { track('wsfy_step', { step: 'details' }); setStep('details'); }, 3500);
    return () => { if (t) clearTimeout(t); };
  }, [step]);

  // On the final beat, fetch the REAL masked count for the entered identity, then show the reveal.
  useEffect(() => {
    if (step !== 'final-search') return undefined;
    let alive = true;
    const done = (data) => {
      if (!alive) return;
      setReveal({
        count: (data && data.count) || 0,
        lines: (data && data.teaseSummary && data.teaseSummary.lines) || [],
        views: (data && data.profileViews && data.profileViews.count) || 0,
      });
      track('wsfy_reveal', { count: (data && data.count) || 0 });
      setStep('reveal');
    };
    const timer = setTimeout(() => {
      fetchWhoIsSearching({ name: `${firstName.trim()} ${lastName.trim()}`.trim(), city: city.trim(), state: state.trim(), tier: 'free' })
        .then(done)
        .catch(() => done(null));
    }, 2500);
    return () => { alive = false; clearTimeout(timer); };
  }, [step, firstName, lastName, city, state]);

  const startSearch = (e) => {
    e.preventDefault(); setNameError('');
    if (!firstName.trim() || !lastName.trim()) { setNameError('Please enter your first and last name.'); track('validation_error', { reason: 'name_required', step: 'name', flow: 'wsfy' }); return; }
    track('wsfy_step', { step: 'searching-one' }); setStep('searching-one');
  };
  const continueFromLocation = () => {
    if (!state.trim()) { setLocationError('Please select your state to continue.'); return; }
    setLocationError(''); track('wsfy_step', { step: 'searching-two' }); setStep('searching-two');
  };
  const continueFromDetails = () => { track('wsfy_step', { step: 'confirm' }); setStep('confirm'); };
  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) { setAgreeError('Please confirm to continue.'); return; }
    track('wsfy_step', { step: 'final-search' });
    setStep('final-search');
  };
  const goSignup = () => {
    track('wsfy_signup_click', { count: reveal ? reveal.count : 0 });
    const params = new URLSearchParams({ reason: 'wsfy' });
    if (firstName.trim()) params.set('firstName', firstName.trim());
    if (lastName.trim()) params.set('lastName', lastName.trim());
    if (state.trim()) params.set('state', state.trim());
    if (city.trim()) params.set('city', city.trim());
    navigate(`/signup?${params.toString()}`);
  };

  const input = { width: '100%', boxSizing: 'border-box', padding: '0.85rem 0.95rem', fontSize: '1rem', border: `1.5px solid ${P.line}`, borderRadius: 10, outline: 'none', background: '#fff', color: P.ink };
  const cta = { width: '100%', minHeight: 58, marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.06rem', fontWeight: 800, color: '#fff', background: P.green, border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 8px 20px rgba(13,93,47,0.3)' };
  const btnGhost = { ...cta, minHeight: 46, marginTop: '0.6rem', background: 'transparent', color: P.green, boxShadow: 'none', border: `1.5px solid ${P.green}`, fontSize: '0.95rem', fontWeight: 600 };
  const card = { background: '#fff', border: `1px solid ${P.line}`, borderRadius: 16, padding: '1.6rem 1.5rem', boxShadow: '0 10px 30px rgba(5,90,134,0.10)' };
  const label = { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: P.greenDark, margin: '0 0 0.3rem' };
  const secLabel = { margin: '0 0 0.6rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: P.mut };

  return (
    <main style={{ minHeight: '100vh', background: `linear-gradient(180deg, #f0fdf4 0%, #ffffff 42%)` }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.75rem 1rem 2.5rem' }}>
        {step === 'name' && (
          <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
            <h1 style={{ margin: 0, fontSize: '2.1rem', lineHeight: 1.12, fontWeight: 800, letterSpacing: '-0.02em', color: P.ink }}>See Who&apos;s Searching For You</h1>
            <p style={{ margin: '0.6rem 0 0', fontSize: '1rem', color: P.mut, lineHeight: 1.5 }}>People are looking you up right now. Enter your info to find out who.</p>
          </div>
        )}

        <div style={card}>
          {stepIndex >= 2 && stepIndex <= TOTAL_STEPS && (
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
                {[['👀', 'See who has searched for your name'], ['📍', 'Find out where they searched from'], ['🛡️', 'Control what strangers can see about you']].map(([ic, text]) => (
                  <li key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.95rem', lineHeight: 1.4, color: P.ink }}>
                    <span aria-hidden="true" style={{ fontSize: 20, flexShrink: 0 }}>{ic}</span><span>{text}</span>
                  </li>
                ))}
              </ul>
              <form onSubmit={startSearch} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}><label style={label} htmlFor="wsfy-fn">Your first name</label><input id="wsfy-fn" style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="ex. Jordan" required /></div>
                  <div style={{ flex: 1 }}><label style={label} htmlFor="wsfy-ln">Your last name</label><input id="wsfy-ln" style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="ex. Rivera" required /></div>
                </div>
                {nameError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0 }}>{nameError}</p>}
                <button type="submit" style={cta}>👀 See who&apos;s searching</button>
              </form>
              <p style={{ margin: '1.1rem 0 0', fontSize: '0.85rem', lineHeight: 1.5, color: P.mut, textAlign: 'center' }}>
                Your info is used only to match search activity to you — never shared.
              </p>
            </>
          )}

          {step === 'searching-one' && <Searching title="Scanning search activity for your name…" P={P} items={['Recent name searches', 'Phone &amp; email lookups', 'Profile views']} />}

          {step === 'location' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Where are you located?</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut }}>Your location helps us match searches to the right {firstName || 'you'}.</p>
              <label style={label} htmlFor="wsfy-state">State</label>
              <select id="wsfy-state" style={{ ...input, marginBottom: '1rem', borderColor: locationError ? '#b91c1c' : P.line }} value={state} onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }}>
                {US_STATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {locationError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{locationError}</p>}
              <label style={label} htmlFor="wsfy-city">City (optional)</label>
              <input id="wsfy-city" style={{ ...input, marginBottom: '1rem' }} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              <button type="button" style={cta} onClick={continueFromLocation}>Continue</button>
            </div>
          )}

          {step === 'searching-two' && <Searching title="Matching searches to your identity…" P={P} items={['Cross-checking name &amp; location', 'Finding who searched you', 'Checking profile views']} />}

          {step === 'details' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Narrow it down to you</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut }}>A few more details make sure we show searches for the right person.</p>
              <label style={label} htmlFor="wsfy-age">Your age (optional)</label>
              <input id="wsfy-age" style={{ ...input, marginBottom: '0.75rem' }} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
              <label style={label} htmlFor="wsfy-mid">Middle name (optional)</label>
              <input id="wsfy-mid" style={{ ...input, marginBottom: '1rem' }} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name" />
              <button type="button" style={cta} onClick={continueFromDetails}>Continue</button>
              <button type="button" style={btnGhost} onClick={continueFromDetails}>Skip</button>
            </div>
          )}

          {step === 'confirm' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Confirm this is you</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: P.mut }}>We only reveal who&apos;s searching for you to the real you. Confirm the details below are your own identity.</p>
              <div style={{ background: P.bg, border: `1px solid ${P.line}`, borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1rem', fontSize: '0.9rem', color: P.ink }}>
                <strong>{[firstName, middleName, lastName].filter(Boolean).join(' ')}</strong>
                {(city || state) && <span style={{ color: P.mut }}> · {[city, state].filter(Boolean).join(', ')}</span>}
                {age && <span style={{ color: P.mut }}> · {age}</span>}
              </div>
              <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.86rem', color: P.ink, marginBottom: '1rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
                <span>This is my own identity, and I&apos;ll use IDLookup responsibly (not for employment, tenant, or credit screening).</span>
              </label>
              {agreeError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{agreeError}</p>}
              <button type="button" style={cta} onClick={handleConfirm}>Show who&apos;s searching →</button>
              <button type="button" style={btnGhost} onClick={() => setStep('details')}>Back</button>
            </div>
          )}

          {step === 'final-search' && <Searching title="Finding who&apos;s searching for you…" P={P} items={['Compiling searchers', 'Adding profile views', 'Building your report']} />}

          {step === 'reveal' && reveal && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: '1.1rem' }}>
                <span style={{ fontSize: 40 }} aria-hidden="true">👀</span>
                <h2 style={{ margin: '0.4rem 0 0', fontSize: '1.6rem', fontWeight: 800, color: P.green }}>
                  {reveal.count > 0
                    ? `${reveal.count} ${reveal.count === 1 ? 'person is' : 'people are'} searching for you`
                    : 'Your identity is exposed'}
                </h2>
                {reveal.views > 0 && (
                  <p style={{ margin: '0.3rem 0 0', color: P.mut, fontSize: '0.95rem' }}><strong style={{ color: P.ink }}>{reveal.views}</strong> viewed your profile</p>
                )}
              </div>
              {reveal.lines.length > 0 && (
                <div style={{ display: 'grid', gap: 8, marginBottom: '1.1rem' }}>
                  {reveal.lines.slice(0, 4).map((l, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: P.ink, background: P.bg, border: `1px solid ${P.line}`, borderRadius: 10, padding: '0.6rem 0.85rem' }}>
                      <span aria-hidden="true">🔒</span><span style={{ filter: 'blur(0.3px)' }}>{l}</span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut, lineHeight: 1.5 }}>
                Create your free account to unlock exactly who&apos;s searching for you — names, locations, and how they know you — and control what they can see.
              </p>
              <button type="button" style={cta} onClick={goSignup}>See who&apos;s searching →</button>
            </div>
          )}
        </div>
      </div>
      <ColorLandingFooter bg={P.greenDark} fg="rgba(255,255,255,0.78)" accent="#bbf7d0" />
    </main>
  );
};

const Searching = ({ title, items, P }) => (
  <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
    <div style={{ width: 46, height: 46, border: `4px solid ${P.bg}`, borderTopColor: P.green, borderRadius: '50%', margin: '0 auto 1.1rem', animation: 'spin 0.8s linear infinite' }} />
    <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.3rem', fontWeight: 800, color: P.ink }} dangerouslySetInnerHTML={{ __html: title }} />
    <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0', fontSize: '0.9rem', color: P.mut, lineHeight: 1.9 }}>
      {items.map((it) => <li key={it} dangerouslySetInnerHTML={{ __html: `✓ ${it}` }} />)}
    </ul>
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
  </div>
);

export default WsfyLandingPage;
