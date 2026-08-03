import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import { useBrand } from '../../services/brand';
import US_STATES from './usStates';
import ColorLandingFooter from './ColorLandingFooter';

/**
 * Name landing v9 — "Clean minimal white" exploration.
 * DESIGN: white base, heavy whitespace, one blue accent (#2563eb); TRUST-BAND-FIRST IA —
 * a security/record trust strip sits above the form. Distinct from green v2-v6, blue v7,
 * dark v8. Self-chrome. FLOW/TRACKING identical wizard (variant 'v9').
 */
const P = { ink: '#0f172a', mut: '#64748b', accent: '#2563eb', line: '#e5e9f0', bg: '#ffffff' };
const TOTAL_STEPS = 4;
const getStepIndex = (s) => ({ name: 1, location: 2, details: 3, confirm: 4 }[s] || 0);

const NameSearchLandingV9Page = () => {
  const brand = useBrand();
  useLandingTrack('name', 'v9');
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
    if (step === 'searching-one') t = setTimeout(() => { track('search_step', { step: 'location', search_type: 'name', variant: 'v9' }); setStep('location'); }, 1700);
    if (step === 'searching-two') t = setTimeout(() => { track('search_step', { step: 'details', search_type: 'name', variant: 'v9' }); setStep('details'); }, 1700);
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
    track('search_step', { step: 'searching-one', search_type: 'name', variant: 'v9' }); setStep('searching-one');
  };
  const continueFromLocation = () => {
    if (!state.trim()) { setLocationError('Please select a state before continuing.'); track('validation_error', { reason: 'state_required', step: 'location' }); return; }
    setLocationError(''); track('search_step', { step: 'searching-two', search_type: 'name', variant: 'v9' }); setStep('searching-two');
  };
  const continueFromDetails = () => { track('search_step', { step: 'confirm', search_type: 'name', variant: 'v9' }); setStep('confirm'); };
  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) { setAgreeError('You must agree before continuing.'); track('validation_error', { reason: 'fcra_not_agreed', step: 'confirm' }); return; }
    track('search_step', { step: 'final-search', search_type: 'name', variant: 'v9' });
    track('fcra_agree', { search_type: 'name', variant: 'v9' });
    setStep('final-search'); runSearch();
  };

  const input = { width: '100%', boxSizing: 'border-box', padding: '0.9rem 1rem', fontSize: '1rem', border: `1.5px solid ${P.line}`, borderRadius: 10, outline: 'none', color: P.ink };
  const btn = { width: '100%', padding: '0.95rem', fontSize: '1.02rem', fontWeight: 700, color: '#fff', background: P.accent, border: 'none', borderRadius: 10, cursor: 'pointer' };
  const btnGhost = { ...btn, background: '#fff', color: P.accent, border: `1.5px solid ${P.accent}` };
  const label = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: P.mut, margin: '0 0 0.35rem' };

  return (
    <main style={{ minHeight: '100vh', background: P.bg, color: P.ink }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '1.5rem 1.15rem 2rem' }}>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: P.ink }}>{brand.name}</p>

        {/* Trust band FIRST */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', margin: '1rem 0', fontSize: '0.78rem', color: P.mut }}>
          <span>🔒 256-bit SSL</span><span>📋 Billions of records</span><span>🛡️ Secure</span><span>🇺🇸 All 50 states</span>
        </div>

        <h1 style={{ margin: '0.5rem 0 0.3rem', fontSize: '1.7rem', fontWeight: 800, color: P.ink, lineHeight: 1.15 }}>Search public records.</h1>
        <p style={{ margin: '0 0 1.5rem', fontSize: '0.95rem', color: P.mut }}>Look up contact info, addresses, relatives, and background records for anyone in the U.S.</p>

        {stepIndex >= 1 && stepIndex <= TOTAL_STEPS && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.72rem', color: P.mut, marginBottom: 5 }}>Step {stepIndex} of {TOTAL_STEPS}</div>
            <div style={{ height: 4, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${(stepIndex / TOTAL_STEPS) * 100}%`, height: '100%', background: P.accent }} /></div>
          </div>
        )}

        {step === 'name' && (
          <form onSubmit={startSearch}>
            <label style={label}>First name</label>
            <input style={{ ...input, marginBottom: '0.85rem' }} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" required />
            <label style={label}>Last name</label>
            <input style={{ ...input, marginBottom: '1.15rem' }} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" required />
            {nameError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{nameError}</p>}
            <button type="submit" style={btn}>Search →</button>
          </form>
        )}
        {step === 'searching-one' && <Searching title="Searching public records…" P={P} />}
        {step === 'location' && (
          <div>
            <h2 style={{ margin: '0 0 0.9rem', fontSize: '1.1rem', fontWeight: 700, color: P.ink }}>Which state?</h2>
            <label style={label}>City (optional)</label>
            <input style={{ ...input, marginBottom: '0.85rem' }} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
            <label style={label}>State *</label>
            <select style={{ ...input, marginBottom: '1.15rem', borderColor: locationError ? '#b91c1c' : P.line }} value={state} onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }}>
              {US_STATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {locationError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{locationError}</p>}
            <button type="button" style={btn} onClick={continueFromLocation}>Continue</button>
          </div>
        )}
        {step === 'searching-two' && <Searching title={`Finding matches for ${firstName} ${lastName}…`} P={P} />}
        {step === 'details' && (
          <div>
            <h2 style={{ margin: '0 0 0.9rem', fontSize: '1.1rem', fontWeight: 700, color: P.ink }}>Narrow your results</h2>
            <label style={label}>Age (optional)</label>
            <input style={{ ...input, marginBottom: '0.85rem' }} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
            <label style={label}>Middle name (optional)</label>
            <input style={{ ...input, marginBottom: '1.15rem' }} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name" />
            <button type="button" style={{ ...btn, marginBottom: '0.5rem' }} onClick={continueFromDetails}>Continue</button>
            <button type="button" style={btnGhost} onClick={continueFromDetails}>Skip</button>
          </div>
        )}
        {step === 'confirm' && (
          <div>
            <h2 style={{ margin: '0 0 0.6rem', fontSize: '1.1rem', fontWeight: 700, color: P.ink }}>Confirm to view results</h2>
            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.84rem', color: P.mut, marginBottom: '1.15rem', cursor: 'pointer' }}>
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
      <ColorLandingFooter bg="#f8fafc" fg="#64748b" accent="#2563eb" />
    </main>
  );
};

const Searching = ({ title, P }) => (
  <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
    <div style={{ width: 40, height: 40, border: `3px solid #eef2f7`, borderTopColor: P.accent, borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 0.8s linear infinite' }} />
    <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: P.ink }}>{title}</h2>
    <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: P.mut }}>✓ Public records ✓ Contact info ✓ Court &amp; property</p>
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
  </div>
);

export default NameSearchLandingV9Page;
