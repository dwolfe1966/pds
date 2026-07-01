import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import { useBrand } from '../../services/brand';
import US_STATES from './usStates';
import ColorLandingFooter from './ColorLandingFooter';

/**
 * Name landing v3b — "Dark premium split" design (visually matches v8) with INMATE-focused
 * language. Same charcoal + amber palette + split layout as v8; the preview panel lists
 * inmate-relevant records. Self-chrome. Wizard + tracking identical (variant 'v3b').
 */
const P = { bg0: '#0f1629', bg1: '#16213e', panel: '#1e2a47', amber: '#f59e0b', amberDk: '#d97706', ink: '#eef2f9', mut: '#9aa7bd', line: 'rgba(255,255,255,0.12)' };
const TOTAL_STEPS = 4;
const getStepIndex = (s) => ({ name: 1, location: 2, details: 3, confirm: 4 }[s] || 0);

const NameSearchLandingV3bPage = () => {
  const brand = useBrand();
  useLandingTrack('name', 'v3b');
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
    if (step === 'searching-one') t = setTimeout(() => { track('search_step', { step: 'location', search_type: 'name', variant: 'v3b' }); setStep('location'); }, 1700);
    if (step === 'searching-two') t = setTimeout(() => { track('search_step', { step: 'details', search_type: 'name', variant: 'v3b' }); setStep('details'); }, 1700);
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
    if (!firstName.trim() || !lastName.trim()) { setNameError("Please enter the inmate's first and last name."); track('validation_error', { reason: 'name_required', step: 'name' }); return; }
    track('search_step', { step: 'searching-one', search_type: 'name', variant: 'v3b' }); setStep('searching-one');
  };
  const continueFromLocation = () => {
    if (!state.trim()) { setLocationError('Please select a state before continuing.'); track('validation_error', { reason: 'state_required', step: 'location' }); return; }
    setLocationError(''); track('search_step', { step: 'searching-two', search_type: 'name', variant: 'v3b' }); setStep('searching-two');
  };
  const continueFromDetails = () => { track('search_step', { step: 'confirm', search_type: 'name', variant: 'v3b' }); setStep('confirm'); };
  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) { setAgreeError('You must agree before continuing.'); track('validation_error', { reason: 'fcra_not_agreed', step: 'confirm' }); return; }
    track('search_step', { step: 'final-search', search_type: 'name', variant: 'v3b' });
    track('fcra_agree', { search_type: 'name', variant: 'v3b' });
    setStep('final-search'); runSearch();
  };

  const input = { width: '100%', boxSizing: 'border-box', padding: '0.85rem 0.95rem', fontSize: '1rem', border: `1.5px solid ${P.line}`, borderRadius: 10, outline: 'none', background: 'rgba(255,255,255,0.06)', color: P.ink };
  const btnPrimary = { width: '100%', padding: '0.95rem', fontSize: '1.02rem', fontWeight: 800, color: '#1a1206', background: `linear-gradient(180deg, ${P.amber}, ${P.amberDk})`, border: 'none', borderRadius: 10, cursor: 'pointer', boxShadow: '0 6px 18px rgba(245,158,11,0.35)' };
  const btnGhost = { ...btnPrimary, background: 'transparent', color: P.amber, boxShadow: 'none', border: `1.5px solid ${P.amber}` };
  const label = { display: 'block', fontSize: '0.78rem', fontWeight: 700, color: P.mut, margin: '0 0 0.35rem' };
  const cardStyle = { background: P.bg1, border: `1px solid ${P.line}`, borderRadius: 16, padding: '1.5rem 1.35rem' };

  return (
    <main style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${P.bg0} 0%, ${P.bg1} 100%)`, color: P.ink }}>
      <div style={{ padding: '1.6rem 1.1rem 0.5rem', maxWidth: 920, margin: '0 auto', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', color: P.amber }}>◆ {brand.name.toUpperCase()} INMATE LOCATOR</p>
        <h1 style={{ margin: '0.4rem 0 0.3rem', fontSize: '1.85rem', fontWeight: 800, lineHeight: 1.1, color: P.ink }}>The complete inmate record.</h1>
        <p style={{ margin: 0, fontSize: '0.95rem', color: P.mut, maxWidth: 470, marginInline: 'auto' }}>Booking, facility, charges, and release status — from jails and prisons nationwide.</p>
      </div>

      <div style={{ maxWidth: 920, margin: '1rem auto 0', padding: '0 1rem 2.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{ ...cardStyle, flex: '1 1 320px' }}>
          {stepIndex >= 1 && stepIndex <= TOTAL_STEPS && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.72rem', color: P.mut, marginBottom: 4 }}>Step {stepIndex} of {TOTAL_STEPS}</div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${(stepIndex / TOTAL_STEPS) * 100}%`, height: '100%', background: P.amber }} /></div>
            </div>
          )}

          {step === 'name' && (
            <form onSubmit={startSearch}>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem', fontWeight: 800, color: P.ink }}>Search for an inmate</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.86rem', color: P.mut }}>Enter the inmate&apos;s first and last name to begin.</p>
              <label style={label}>First name</label>
              <input style={{ ...input, marginBottom: '0.7rem' }} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" required />
              <label style={label}>Last name</label>
              <input style={{ ...input, marginBottom: '1rem' }} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" required />
              {nameError && <p style={{ color: '#fca5a5', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{nameError}</p>}
              <button type="submit" style={btnPrimary}>Search Records →</button>
              <p style={{ textAlign: 'center', fontSize: '0.72rem', color: P.mut, margin: '0.75rem 0 0' }}>🔒 256-bit SSL · Confidential · Instant</p>
            </form>
          )}

          {step === 'searching-one' && <Searching title="Searching jails & prisons…" P={P} />}
          {step === 'location' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.05rem', fontWeight: 800, color: P.ink }}>Which state?</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: P.mut }}>Narrows to the right facilities. City optional.</p>
              <label style={label}>City (optional)</label>
              <input style={{ ...input, marginBottom: '0.7rem' }} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              <label style={label}>State *</label>
              <select style={{ ...input, marginBottom: '1rem', borderColor: locationError ? '#fca5a5' : P.line }} value={state} onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }}>
                {US_STATES.map((o) => <option key={o.value} value={o.value} style={{ color: '#111' }}>{o.label}</option>)}
              </select>
              {locationError && <p style={{ color: '#fca5a5', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{locationError}</p>}
              <button type="button" style={btnPrimary} onClick={continueFromLocation}>Continue</button>
            </div>
          )}
          {step === 'searching-two' && <Searching title={`Finding inmate matches for ${firstName} ${lastName}…`} P={P} />}
          {step === 'details' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.05rem', fontWeight: 800, color: P.ink }}>Possible inmate matches</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: P.mut }}>Add age or middle name to narrow. Optional.</p>
              <label style={label}>Age (optional)</label>
              <input style={{ ...input, marginBottom: '0.7rem' }} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
              <label style={label}>Middle name (optional)</label>
              <input style={{ ...input, marginBottom: '1rem' }} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name" />
              <button type="button" style={{ ...btnPrimary, marginBottom: '0.5rem' }} onClick={continueFromDetails}>Continue</button>
              <button type="button" style={btnGhost} onClick={continueFromDetails}>Skip</button>
            </div>
          )}
          {step === 'confirm' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.05rem', fontWeight: 800, color: P.ink }}>Confirm to view inmate results</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.83rem', color: P.mut }}>{brand.name} reports are not for employment, tenant, credit, or other FCRA purposes.</p>
              <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.83rem', marginBottom: '1rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
                <span>I will not use {brand.name} information for any purpose restricted by the FCRA.</span>
              </label>
              {agreeError && <p style={{ color: '#fca5a5', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{agreeError}</p>}
              <button type="button" style={{ ...btnPrimary, marginBottom: '0.5rem' }} onClick={handleConfirm}>I Agree — View Results</button>
              <button type="button" style={btnGhost} onClick={() => setStep('details')}>Back</button>
            </div>
          )}
          {step === 'final-search' && <Searching title="Searching our database…" P={P} />}
        </div>

        <div style={{ ...cardStyle, flex: '1 1 240px', background: P.panel }}>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', color: P.amber }}>EVERY INMATE REPORT INCLUDES</p>
          {[['🏛️', 'Current facility & location'], ['📋', 'Booking & arrest records'], ['⚖️', 'Charges & case details'], ['📸', 'Mugshots'], ['📅', 'Release status & dates'], ['🔎', 'Criminal & court history']].map(([icon, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.45rem 0', borderBottom: `1px solid ${P.line}`, fontSize: '0.88rem' }}>
              <span>{icon}</span><span style={{ color: P.ink }}>{l}</span>
            </div>
          ))}
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.72rem', color: P.mut }}>Sourced from county, state &amp; federal facilities across 50 states.</p>
        </div>
      </div>

      <ColorLandingFooter bg={P.bg0} fg="rgba(255,255,255,0.7)" accent={P.amber} />
    </main>
  );
};

const Searching = ({ title, P }) => (
  <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
    <div style={{ width: 44, height: 44, border: `4px solid rgba(255,255,255,0.12)`, borderTopColor: P.amber, borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 0.8s linear infinite' }} />
    <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: P.ink }}>{title}</h2>
    <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: P.mut }}>✓ County jails ✓ State prisons ✓ Federal facilities</p>
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
  </div>
);

export default NameSearchLandingV3bPage;
