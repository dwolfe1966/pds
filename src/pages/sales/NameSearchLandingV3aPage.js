import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import { useBrand } from '../../services/brand';
import US_STATES from './usStates';
import ColorLandingFooter from './ColorLandingFooter';

/**
 * Name landing v3a — "Trust-blue" design (visually matches v7) with INMATE-focused language.
 * Same blue palette + search-bar hero + big-number band as v7; copy is inmate-locator themed
 * (jails/prisons/facilities). Self-chrome. Wizard + tracking identical (variant 'v3a').
 */
const P = { blue: '#007cc2', blueDark: '#055a86', orange: '#fd6f0b', ink: '#0f2533', mut: '#5b7484', line: '#d3e3ec', bg: '#eef6fb' };
const TOTAL_STEPS = 4;
const getStepIndex = (s) => ({ name: 1, location: 2, details: 3, confirm: 4 }[s] || 0);

const NameSearchLandingV3aPage = () => {
  const brand = useBrand();
  useLandingTrack('name', 'v3a', true, 'blue');
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
    if (step === 'searching-one') t = setTimeout(() => { track('search_step', { step: 'location', search_type: 'name', variant: 'v3a' }); setStep('location'); }, 1700);
    if (step === 'searching-two') t = setTimeout(() => { track('search_step', { step: 'details', search_type: 'name', variant: 'v3a' }); setStep('details'); }, 1700);
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
    track('search_step', { step: 'searching-one', search_type: 'name', variant: 'v3a' }); setStep('searching-one');
  };
  const continueFromLocation = () => {
    if (!state.trim()) { setLocationError('Please select a state before continuing.'); track('validation_error', { reason: 'state_required', step: 'location' }); return; }
    setLocationError(''); track('search_step', { step: 'searching-two', search_type: 'name', variant: 'v3a' }); setStep('searching-two');
  };
  const continueFromDetails = () => { track('search_step', { step: 'confirm', search_type: 'name', variant: 'v3a' }); setStep('confirm'); };
  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) { setAgreeError('You must agree before continuing.'); track('validation_error', { reason: 'fcra_not_agreed', step: 'confirm' }); return; }
    track('search_step', { step: 'final-search', search_type: 'name', variant: 'v3a' });
    track('fcra_agree', { search_type: 'name', variant: 'v3a' });
    setStep('final-search'); runSearch();
  };

  const input = { width: '100%', boxSizing: 'border-box', padding: '0.85rem 0.95rem', fontSize: '1rem', border: `1.5px solid ${P.line}`, borderRadius: 10, outline: 'none', background: '#fff', color: P.ink };
  const btnPrimary = { width: '100%', padding: '0.95rem', fontSize: '1.02rem', fontWeight: 800, color: '#fff', background: P.orange, border: 'none', borderRadius: 10, cursor: 'pointer', letterSpacing: '0.01em', boxShadow: '0 4px 14px rgba(253,111,11,0.35)' };
  const btnGhost = { ...btnPrimary, background: 'transparent', color: P.blue, boxShadow: 'none', border: `1.5px solid ${P.blue}` };
  const card = { background: '#fff', border: `1px solid ${P.line}`, borderRadius: 16, padding: '1.5rem 1.35rem', boxShadow: '0 8px 30px rgba(5,90,134,0.10)' };
  const label = { display: 'block', fontSize: '0.8rem', fontWeight: 700, color: P.blueDark, margin: '0 0 0.35rem' };

  return (
    <main style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${P.bg} 0%, #ffffff 45%)` }}>
      <div style={{ background: `linear-gradient(135deg, ${P.blue} 0%, ${P.blueDark} 100%)`, color: '#fff', padding: '1.6rem 1.1rem 3.5rem', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, opacity: 0.85, letterSpacing: '0.04em' }}>🔍 {brand.name.toUpperCase()} INMATE LOCATOR</p>
        <h1 style={{ margin: '0.5rem 0 0.3rem', fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.1, color: '#ffffff' }}>Find an Inmate.</h1>
        <p style={{ margin: 0, fontSize: '0.95rem', opacity: 0.92, maxWidth: 480, marginInline: 'auto' }}>
          Search county jails, state prisons, and federal facilities nationwide.
        </p>
      </div>

      <div style={{ maxWidth: 540, margin: '-2.5rem auto 0', padding: '0 1rem 3rem' }}>
        <div style={card}>
          {stepIndex >= 1 && stepIndex <= TOTAL_STEPS && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: P.mut, marginBottom: 4 }}><span>Step {stepIndex} of {TOTAL_STEPS}</span></div>
              <div style={{ height: 6, background: P.bg, borderRadius: 999, overflow: 'hidden' }}><div style={{ width: `${(stepIndex / TOTAL_STEPS) * 100}%`, height: '100%', background: P.blue }} /></div>
            </div>
          )}

          {step === 'name' && (
            <form onSubmit={startSearch}>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.15rem', fontWeight: 800, color: P.ink }}>Who are you looking for?</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: P.mut }}>Enter the inmate&apos;s first and last name to search jails and prisons.</p>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <input style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" aria-label="First name" required />
                <input style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" aria-label="Last name" required />
              </div>
              {nameError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{nameError}</p>}
              <button type="submit" style={btnPrimary}>🔍 Search Now</button>
              <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginTop: '1.25rem', paddingTop: '1.1rem', borderTop: `1px solid ${P.line}` }}>
                {[['Billions', 'Records'], ['Jails &', 'Prisons'], ['50', 'States']].map(([n, l]) => (
                  <div key={l}><div style={{ fontSize: '1.15rem', fontWeight: 800, color: P.blue }}>{n}</div><div style={{ fontSize: '0.68rem', color: P.mut }}>{l}</div></div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.9rem', fontSize: '0.72rem', color: P.mut }}>
                <span>🔒 256-bit SSL</span><span>🛡️ Confidential</span><span>⚡ Instant</span>
              </div>
            </form>
          )}

          {step === 'searching-one' && <Searching title="Searching jails &amp; prisons…" P={P} items={['County jails', 'State prisons', 'Federal facilities']} />}

          {step === 'location' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem', fontWeight: 800, color: P.ink }}>Which state?</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.86rem', color: P.mut }}>Narrows to the right county jails &amp; state prisons. City is optional.</p>
              <label style={label} htmlFor="v3a-city">City (optional)</label>
              <input id="v3a-city" style={{ ...input, marginBottom: '0.75rem' }} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              <label style={label} htmlFor="v3a-state">State *</label>
              <select id="v3a-state" style={{ ...input, marginBottom: '1rem', borderColor: locationError ? '#b91c1c' : P.line }} value={state} onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }}>
                {US_STATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {locationError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{locationError}</p>}
              <button type="button" style={btnPrimary} onClick={continueFromLocation}>Continue</button>
            </div>
          )}

          {step === 'searching-two' && <Searching title={`Finding inmate matches for ${firstName} ${lastName}…`} P={P} items={['Matching facilities', 'Checking inmate records', 'County &amp; state databases']} />}

          {step === 'details' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem', fontWeight: 800, color: P.ink }}>Possible inmate matches found</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.86rem', color: P.mut }}>Add age or middle name to narrow results. Optional.</p>
              <label style={label} htmlFor="v3a-age">Age (optional)</label>
              <input id="v3a-age" style={{ ...input, marginBottom: '0.75rem' }} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
              <label style={label} htmlFor="v3a-mid">Middle name (optional)</label>
              <input id="v3a-mid" style={{ ...input, marginBottom: '1rem' }} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name" />
              <button type="button" style={{ ...btnPrimary, marginBottom: '0.5rem' }} onClick={continueFromDetails}>Continue</button>
              <button type="button" style={btnGhost} onClick={continueFromDetails}>Skip</button>
            </div>
          )}

          {step === 'confirm' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.1rem', fontWeight: 800, color: P.ink }}>Confirm to view inmate results</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.84rem', color: P.mut }}>{brand.name} reports are not for employment, tenant, credit, or other FCRA purposes.</p>
              <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.84rem', color: P.ink, marginBottom: '1rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
                <span>I will not use {brand.name} information for employment, insurance, tenant screening, consumer credit, or any purpose restricted by the FCRA.</span>
              </label>
              {agreeError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{agreeError}</p>}
              <button type="button" style={{ ...btnPrimary, marginBottom: '0.5rem' }} onClick={handleConfirm}>I Agree — View Results</button>
              <button type="button" style={btnGhost} onClick={() => setStep('details')}>Back</button>
            </div>
          )}

          {step === 'final-search' && <Searching title="Searching our database…" P={P} items={['County jails', 'State prisons', 'Federal facilities', 'Booking &amp; release records']} />}
        </div>
      </div>
      <ColorLandingFooter bg={P.blueDark} fg="rgba(255,255,255,0.78)" accent="#cfe6f2" />
    </main>
  );
};

const Searching = ({ title, items, P }) => (
  <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
    <div style={{ width: 44, height: 44, border: `4px solid ${P.bg}`, borderTopColor: P.blue, borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 0.8s linear infinite' }} />
    <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.1rem', fontWeight: 800, color: P.ink }} dangerouslySetInnerHTML={{ __html: title }} />
    <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0', fontSize: '0.85rem', color: P.mut, lineHeight: 1.9 }}>
      {items.map((it) => <li key={it} dangerouslySetInnerHTML={{ __html: `✓ ${it}` }} />)}
    </ul>
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
  </div>
);

export default NameSearchLandingV3aPage;
