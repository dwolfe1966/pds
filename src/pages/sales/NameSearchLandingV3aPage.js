import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import { useBrand } from '../../services/brand';
import US_STATES from './usStates';
import ColorLandingFooter from './ColorLandingFooter';
import { Icon, BENEFITS, VALUE_PREVIEW } from './landingIcons';

/**
 * Name landing v3a — the v3 incarceration redesign in v3a's TRUST-BLUE scheme,
 * single column. Self-chrome. Wizard + tracking identical (variant 'v3a').
 */
const P = { blue: '#007cc2', blueDark: '#055a86', orange: '#fd6f0b', ink: '#0f2533', mut: '#5b7484', line: '#d3e3ec', bg: '#eef6fb', chip: '#eaf3fa' };
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
    try { sessionStorage.removeItem('nameSearchResults'); } catch { /* ignore */ }
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
  const cta = { width: '100%', minHeight: 58, marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.06rem', fontWeight: 800, color: '#fff', background: P.orange, border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 8px 20px rgba(253,111,11,0.35)' };
  const btnGhost = { ...cta, minHeight: 46, marginTop: '0.6rem', background: 'transparent', color: P.blue, boxShadow: 'none', border: `1.5px solid ${P.blue}`, fontSize: '0.95rem', fontWeight: 600 };
  const card = { background: '#fff', border: `1px solid ${P.line}`, borderRadius: 16, padding: '1.6rem 1.5rem', boxShadow: '0 10px 30px rgba(5,90,134,0.10)' };
  const label = { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: P.blueDark, margin: '0 0 0.3rem' };
  const secLabel = { margin: '0 0 0.6rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: P.mut };
  const chip = { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.83rem', fontWeight: 600, color: P.ink, background: P.chip, border: `1px solid ${P.line}`, borderRadius: 999, padding: '0.4rem 0.75rem' };

  return (
    <main style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${P.bg} 0%, #ffffff 42%)` }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.75rem 1rem 2.5rem' }}>
        {step === 'name' && (
          <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
            <h1 style={{ margin: '0 0 0.75rem', fontSize: '2.1rem', lineHeight: 1.12, fontWeight: 800, letterSpacing: '-0.02em', color: P.ink }}>Find Someone in Jail or Prison</h1>
            <p style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', margin: 0, fontSize: '0.85rem', fontWeight: 600, color: P.blueDark, background: '#e3f1f9', border: '1px solid #c6e3f2', borderRadius: 999, padding: '0.4rem 0.9rem' }}>
              <Icon name="lock" style={{ width: 15, height: 15, color: P.blue }} /> Results in Seconds
            </p>
          </div>
        )}

        <div style={card}>
          {stepIndex >= 2 && stepIndex <= TOTAL_STEPS && (
            <div style={{ marginBottom: '1.3rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: P.mut }}>Step {stepIndex} of {TOTAL_STEPS}</p>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[1, 2, 3, 4].map((n) => <div key={n} style={{ flex: 1, height: 6, borderRadius: 999, background: n <= stepIndex ? P.blue : '#dbe9f2' }} />)}
              </div>
            </div>
          )}

          {step === 'name' && (
            <>
              <ul style={{ listStyle: 'none', margin: '0 0 1.3rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                {BENEFITS.map(([ic, text]) => (
                  <li key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.95rem', lineHeight: 1.4, color: P.ink }}>
                    <Icon name={ic} style={{ width: 22, height: 22, color: P.blue, flexShrink: 0, marginTop: 1 }} /><span>{text}</span>
                  </li>
                ))}
              </ul>

              <form onSubmit={startSearch} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div style={{ flex: 1 }}><label style={label} htmlFor="v3a-fn">First name</label><input id="v3a-fn" style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" required /></div>
                  <div style={{ flex: 1 }}><label style={label} htmlFor="v3a-ln">Last name</label><input id="v3a-ln" style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" required /></div>
                </div>
                <details open={!!middleName} style={{ borderTop: '1px solid #eef3f7', paddingTop: '0.4rem' }}>
                  <summary style={{ cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: P.blue, listStyle: 'none' }}>+ Advanced search</summary>
                  <div style={{ marginTop: '0.7rem' }}><label style={label} htmlFor="v3a-mn">Middle name (optional)</label><input id="v3a-mn" style={input} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Michael" /></div>
                </details>
                {nameError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0 }}>{nameError}</p>}
                <div>
                  <p style={secLabel}>What you may find</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {VALUE_PREVIEW.map(([ic, l]) => <span key={l} style={chip}><Icon name={ic} style={{ width: 15, height: 15, color: P.blueDark, flexShrink: 0 }} />{l}</span>)}
                  </div>
                </div>
                <button type="submit" style={cta}><Icon name="search" style={{ width: 20, height: 20 }} /> Search Records</button>
              </form>

              <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem', margin: '1.1rem 0 0', fontSize: '0.85rem', lineHeight: 1.5, color: P.mut, textAlign: 'left' }}>
                <Icon name="seal" style={{ width: 22, height: 22, color: P.blue, flexShrink: 0 }} /> Used by families, attorneys, journalists, and concerned individuals to locate incarceration records.
              </p>
            </>
          )}

          {step === 'searching-one' && <Searching title="Searching jails &amp; prisons…" P={P} items={['County jails', 'State prisons', 'Federal facilities']} />}

          {step === 'location' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Which state?</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut }}>Narrows the search to the right county jails &amp; state prisons. City is optional.</p>
              <label style={label} htmlFor="v3a-city">City (optional)</label>
              <input id="v3a-city" style={{ ...input, marginBottom: '0.75rem' }} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              <label style={label} htmlFor="v3a-state">State</label>
              <select id="v3a-state" style={{ ...input, marginBottom: '1rem', borderColor: locationError ? '#b91c1c' : P.line }} value={state} onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }}>
                {US_STATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {locationError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{locationError}</p>}
              <button type="button" style={cta} onClick={continueFromLocation}>Continue</button>
            </div>
          )}

          {step === 'searching-two' && <Searching title={`Finding inmate matches for ${firstName} ${lastName}…`} P={P} items={['Matching facilities', 'Checking inmate records', 'County &amp; state databases']} />}

          {step === 'details' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Possible inmate matches found</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut }}>Add age or middle name to narrow results. All fields optional.</p>
              <label style={label} htmlFor="v3a-age">Age (optional)</label>
              <input id="v3a-age" style={{ ...input, marginBottom: '0.75rem' }} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
              <label style={label} htmlFor="v3a-mid2">Middle name (optional)</label>
              <input id="v3a-mid2" style={{ ...input, marginBottom: '1rem' }} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name" />
              <button type="button" style={cta} onClick={continueFromDetails}>Continue</button>
              <button type="button" style={btnGhost} onClick={continueFromDetails}>Skip</button>
            </div>
          )}

          {step === 'confirm' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Confirm to view inmate results</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: P.mut }}>{brand.name} reports are not for employment, tenant screening, credit, or other FCRA purposes.</p>
              <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.86rem', color: P.ink, marginBottom: '1rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
                <span>I will not use {brand.name} information for employment, insurance, tenant screening, consumer credit, or any purpose restricted by the FCRA.</span>
              </label>
              {agreeError && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{agreeError}</p>}
              <button type="button" style={cta} onClick={handleConfirm}>I Agree — View Results</button>
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
    <div style={{ width: 46, height: 46, border: `4px solid ${P.bg}`, borderTopColor: P.blue, borderRadius: '50%', margin: '0 auto 1.1rem', animation: 'spin 0.8s linear infinite' }} />
    <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.3rem', fontWeight: 800, color: P.ink }} dangerouslySetInnerHTML={{ __html: title }} />
    <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0', fontSize: '0.9rem', color: P.mut, lineHeight: 1.9 }}>
      {items.map((it) => <li key={it} dangerouslySetInnerHTML={{ __html: `✓ ${it}` }} />)}
    </ul>
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
  </div>
);

export default NameSearchLandingV3aPage;
