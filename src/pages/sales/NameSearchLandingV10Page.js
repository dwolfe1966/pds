import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import { useBrand } from '../../services/brand';
import US_STATES from './usStates';
import ColorLandingFooter from './ColorLandingFooter';

/**
 * Name landing v10 — "Warm safety" exploration.
 * DESIGN: warm cream base, teal (#0d9488) + coral (#f97316) accents; USE-CASE QUADRANTS IA
 * (Identify / Safeguard / Reconnect / Research) above the form — PeopleFinders' safety+
 * connection framing. Distinct from green/blue/dark/white variants. Self-chrome.
 * FLOW/TRACKING identical wizard (variant 'v10').
 */
const P = { ink: '#1c1917', mut: '#78716c', teal: '#0d9488', coral: '#f97316', line: '#ecdfd2', cream: '#fffaf3' };
const TOTAL_STEPS = 4;
const getStepIndex = (s) => ({ name: 1, location: 2, details: 3, confirm: 4 }[s] || 0);
const QUADRANTS = [
  { icon: '🔍', t: 'Identify', d: 'An unknown caller or email' },
  { icon: '🛡️', t: 'Safeguard', d: 'Protect your loved ones' },
  { icon: '🤝', t: 'Reconnect', d: 'People from your past' },
  { icon: '🏘️', t: 'Research', d: 'Neighbors & new contacts' },
];

const NameSearchLandingV10Page = () => {
  const brand = useBrand();
  useLandingTrack('name', 'v10');
  const navigate = useNavigate();
  const location = useLocation();
  const q = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [firstName, setFirstName] = useState(q.get('fn') || q.get('firstName') || '');
  const [middleName, setMiddleName] = useState(q.get('mn') || q.get('middleName') || '');
  const [lastName, setLastName] = useState(q.get('ln') || q.get('lastName') || '');
  const [city, setCity] = useState(q.get('city') || '');
  const [state, setState] = useState(q.get('state') || '');
  const [age, setAge] = useState(q.get('age') || '');
  const [step, setStep] = useState('name');
  const [agree, setAgree] = useState(false);
  const [nameError, setNameError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [agreeError, setAgreeError] = useState('');
  const stepIndex = getStepIndex(step);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);
  useEffect(() => {
    let t;
    if (step === 'searching-one') t = setTimeout(() => { track('search_step', { step: 'location', search_type: 'name', variant: 'v10' }); setStep('location'); }, 1700);
    if (step === 'searching-two') t = setTimeout(() => { track('search_step', { step: 'details', search_type: 'name', variant: 'v10' }); setStep('details'); }, 1700);
    return () => { if (t) clearTimeout(t); };
  }, [step]);

  const runSearch = () => {
    gtmSetSearchInput({ firstName: firstName.trim(), lastName: lastName.trim(), middleName: middleName.trim(), city: city.trim(), state: state.trim() });
    try { sessionStorage.removeItem('nameSearchResults'); } catch {}
    const params = new URLSearchParams();
    params.set('firstName', firstName.trim());
    params.set('lastName', lastName.trim());
    if (state.trim()) params.set('state', state.trim());
    if (middleName.trim()) params.set('middleName', middleName.trim());
    if (age.trim()) params.set('age', age.trim());
    if (city.trim()) params.set('city', city.trim());
    navigate(`/name/loader?${params.toString()}`);
  };
  const startSearch = (e) => {
    e.preventDefault(); setNameError('');
    if (!firstName.trim() || !lastName.trim()) { setNameError('Please enter a first and last name to search.'); track('validation_error', { reason: 'name_required', step: 'name' }); return; }
    track('search_step', { step: 'searching-one', search_type: 'name', variant: 'v10' }); setStep('searching-one');
  };
  const continueFromLocation = () => {
    if (!state.trim()) { setLocationError('Please select a state before continuing.'); track('validation_error', { reason: 'state_required', step: 'location' }); return; }
    setLocationError(''); track('search_step', { step: 'searching-two', search_type: 'name', variant: 'v10' }); setStep('searching-two');
  };
  const continueFromDetails = () => { track('search_step', { step: 'confirm', search_type: 'name', variant: 'v10' }); setStep('confirm'); };
  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) { setAgreeError('You must agree before continuing.'); track('validation_error', { reason: 'fcra_not_agreed', step: 'confirm' }); return; }
    track('search_step', { step: 'final-search', search_type: 'name', variant: 'v10' });
    track('fcra_agree', { search_type: 'name', variant: 'v10' });
    setStep('final-search'); runSearch();
  };

  const input = { width: '100%', boxSizing: 'border-box', padding: '0.9rem 1rem', fontSize: '1rem', border: `1.5px solid ${P.line}`, borderRadius: 12, outline: 'none', background: '#fff', color: P.ink };
  const btn = { width: '100%', padding: '0.95rem', fontSize: '1.02rem', fontWeight: 800, color: '#fff', background: P.teal, border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 14px rgba(13,148,136,0.28)' };
  const btnGhost = { ...btn, background: '#fff', color: P.teal, boxShadow: 'none', border: `1.5px solid ${P.teal}` };
  const label = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: P.mut, margin: '0 0 0.35rem' };
  const card = { background: '#fff', border: `1px solid ${P.line}`, borderRadius: 18, padding: '1.5rem 1.35rem', boxShadow: '0 6px 24px rgba(28,25,23,0.06)' };

  return (
    <main style={{ minHeight: '100vh', background: P.cream, color: P.ink }}>
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '1.5rem 1.15rem 2rem' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: P.teal }}>❤ {brand.name.toUpperCase()}</p>
        <h1 style={{ margin: '0.5rem 0 0.3rem', fontSize: '1.75rem', fontWeight: 800, color: P.ink, lineHeight: 1.15 }}>Stay safe. Stay connected.</h1>
        <p style={{ margin: '0 0 1.15rem', fontSize: '0.95rem', color: P.mut }}>Search billions of public records to find and verify people you care about.</p>

        {/* Use-case quadrants (only on the entry step) */}
        {step === 'name' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', margin: '0 0 1.25rem' }}>
            {QUADRANTS.map((qd) => (
              <div key={qd.t} style={{ background: '#fff', border: `1px solid ${P.line}`, borderRadius: 12, padding: '0.75rem 0.85rem' }}>
                <div style={{ fontSize: '1.15rem' }}>{qd.icon}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: P.ink, marginTop: 2 }}>{qd.t}</div>
                <div style={{ fontSize: '0.72rem', color: P.mut, lineHeight: 1.3 }}>{qd.d}</div>
              </div>
            ))}
          </div>
        )}

        <div style={card}>
          {stepIndex >= 1 && stepIndex <= TOTAL_STEPS && (
            <div style={{ marginBottom: '1.1rem' }}>
              <div style={{ fontSize: '0.72rem', color: P.mut, marginBottom: 5 }}>Step {stepIndex} of {TOTAL_STEPS}</div>
              <div style={{ height: 5, background: '#f5efe8', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${(stepIndex / TOTAL_STEPS) * 100}%`, height: '100%', background: P.coral }} /></div>
            </div>
          )}

          {step === 'name' && (
            <form onSubmit={startSearch}>
              <h2 style={{ margin: '0 0 0.9rem', fontSize: '1.1rem', fontWeight: 800, color: P.ink }}>Who are you looking for?</h2>
              <label style={label}>First name</label>
              <input style={{ ...input, marginBottom: '0.8rem' }} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" required />
              <label style={label}>Last name</label>
              <input style={{ ...input, marginBottom: '1.1rem' }} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" required />
              {nameError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{nameError}</p>}
              <button type="submit" style={btn}>Search Now →</button>
              <p style={{ textAlign: 'center', fontSize: '0.72rem', color: P.mut, margin: '0.75rem 0 0' }}>🔒 Secure · Encrypted · Cancel anytime</p>
            </form>
          )}
          {step === 'searching-one' && <Searching title="Searching public records…" P={P} />}
          {step === 'location' && (
            <div>
              <h2 style={{ margin: '0 0 0.9rem', fontSize: '1.1rem', fontWeight: 800, color: P.ink }}>Which state?</h2>
              <label style={label}>City (optional)</label>
              <input style={{ ...input, marginBottom: '0.8rem' }} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              <label style={label}>State *</label>
              <select style={{ ...input, marginBottom: '1.1rem', borderColor: locationError ? '#b91c1c' : P.line }} value={state} onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }}>
                {US_STATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {locationError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{locationError}</p>}
              <button type="button" style={btn} onClick={continueFromLocation}>Continue</button>
            </div>
          )}
          {step === 'searching-two' && <Searching title={`Finding matches for ${firstName} ${lastName}…`} P={P} />}
          {step === 'details' && (
            <div>
              <h2 style={{ margin: '0 0 0.9rem', fontSize: '1.1rem', fontWeight: 800, color: P.ink }}>Narrow your results</h2>
              <label style={label}>Age (optional)</label>
              <input style={{ ...input, marginBottom: '0.8rem' }} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
              <label style={label}>Middle name (optional)</label>
              <input style={{ ...input, marginBottom: '1.1rem' }} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name" />
              <button type="button" style={{ ...btn, marginBottom: '0.5rem' }} onClick={continueFromDetails}>Continue</button>
              <button type="button" style={btnGhost} onClick={continueFromDetails}>Skip</button>
            </div>
          )}
          {step === 'confirm' && (
            <div>
              <h2 style={{ margin: '0 0 0.6rem', fontSize: '1.1rem', fontWeight: 800, color: P.ink }}>Confirm to view results</h2>
              <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.84rem', color: P.mut, marginBottom: '1.1rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
                <span>I will not use {brand.name} information for any purpose restricted by the FCRA (employment, tenant, credit).</span>
              </label>
              {agreeError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{agreeError}</p>}
              <button type="button" style={{ ...btn, marginBottom: '0.5rem' }} onClick={handleConfirm}>I Agree — View Results</button>
              <button type="button" style={btnGhost} onClick={() => setStep('details')}>Back</button>
            </div>
          )}
          {step === 'final-search' && <Searching title="Searching our database…" P={P} />}
        </div>
      </div>
      <ColorLandingFooter bg="#0f3f3b" fg="rgba(255,255,255,0.75)" accent="#5eead4" />
    </main>
  );
};

const Searching = ({ title, P }) => (
  <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
    <div style={{ width: 40, height: 40, border: `3px solid #f0eae2`, borderTopColor: P.teal, borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 0.8s linear infinite' }} />
    <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: P.ink }}>{title}</h2>
    <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: P.mut }}>✓ Public records ✓ Contact info ✓ Court &amp; property</p>
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
  </div>
);

export default NameSearchLandingV10Page;
