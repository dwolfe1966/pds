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
 * Name landing v3b — the v3 incarceration redesign in v3b's DARK PREMIUM scheme,
 * keeping the two-column split (form left, "what you may find" panel right).
 * Self-chrome. Wizard + tracking identical (variant 'v3b').
 */
const P = { bg0: '#0f1629', bg1: '#16213e', panel: '#1e2a47', amber: '#f59e0b', amberDk: '#d97706', ink: '#eef2f9', mut: '#9aa7bd', line: 'rgba(255,255,255,0.12)' };
const TOTAL_STEPS = 4;
const getStepIndex = (s) => ({ name: 1, location: 2, details: 3, confirm: 4 }[s] || 0);

const NameSearchLandingV3bPage = () => {
  const brand = useBrand();
  useLandingTrack('name', 'v3b', true, 'dark');
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
    if (step === 'searching-one') t = setTimeout(() => { track('search_step', { step: 'location', search_type: 'name', variant: 'v3b' }); setStep('location'); }, 5000);
    if (step === 'searching-two') t = setTimeout(() => { track('search_step', { step: 'details', search_type: 'name', variant: 'v3b' }); setStep('details'); }, 5000);
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
  const cta = { width: '100%', minHeight: 56, marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.04rem', fontWeight: 800, color: '#1a1206', background: `linear-gradient(180deg, ${P.amber}, ${P.amberDk})`, border: 'none', borderRadius: 11, cursor: 'pointer', boxShadow: '0 6px 18px rgba(245,158,11,0.35)' };
  const btnGhost = { ...cta, minHeight: 46, marginTop: '0.6rem', background: 'transparent', color: P.amber, boxShadow: 'none', border: `1.5px solid ${P.amber}`, fontSize: '0.95rem', fontWeight: 600 };
  const label = { display: 'block', fontSize: '0.78rem', fontWeight: 700, color: P.mut, margin: '0 0 0.35rem' };
  const cardStyle = { background: P.bg1, border: `1px solid ${P.line}`, borderRadius: 16, padding: '1.5rem 1.35rem' };
  const h2 = { margin: '0 0 0.2rem', fontSize: '1.2rem', fontWeight: 800, color: P.ink };

  return (
    <main style={{ minHeight: '100vh', background: `linear-gradient(180deg, ${P.bg0} 0%, ${P.bg1} 100%)`, color: P.ink }}>
      <div style={{ padding: '1.8rem 1.1rem 0.5rem', maxWidth: 920, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800, lineHeight: 1.12, letterSpacing: '-0.02em', color: P.ink }}>Find Someone in Jail or Prison</h1>
      </div>

      <div style={{ maxWidth: 920, margin: '1.1rem auto 0', padding: '0 1rem 2.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
        {/* LEFT — the wizard */}
        <div style={{ ...cardStyle, flex: '1 1 340px' }}>
          {stepIndex >= 2 && stepIndex <= TOTAL_STEPS && (
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: P.mut, marginBottom: 6 }}>Step {stepIndex} of {TOTAL_STEPS}</div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[1, 2, 3, 4].map((n) => <div key={n} style={{ flex: 1, height: 6, borderRadius: 999, background: n <= stepIndex ? P.amber : 'rgba(255,255,255,0.1)' }} />)}
              </div>
            </div>
          )}

          {step === 'name' && (
            <>
              <ul style={{ listStyle: 'none', margin: '0 0 1.2rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {BENEFITS.map(([ic, text]) => (
                  <li key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.92rem', lineHeight: 1.4, color: P.ink }}>
                    <Icon name={ic} style={{ width: 20, height: 20, color: P.amber, flexShrink: 0, marginTop: 1 }} /><span>{text}</span>
                  </li>
                ))}
              </ul>
              <form onSubmit={startSearch} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div><label style={label} htmlFor="v3b-fn">Inmate First name</label><input id="v3b-fn" style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="ex. John" required /></div>
                <div><label style={label} htmlFor="v3b-ln">Inmate Last name</label><input id="v3b-ln" style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="ex. Smith" required /></div>
                {nameError && <p style={{ color: '#fca5a5', fontSize: '0.85rem', margin: 0 }}>{nameError}</p>}
                <button type="submit" style={cta}><Icon name="search" style={{ width: 20, height: 20 }} /> Search Records</button>
              </form>
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', margin: '1.1rem 0 0', fontSize: '0.84rem', lineHeight: 1.5, color: P.mut }}>
                <Icon name="seal" style={{ width: 22, height: 22, color: P.amber, flexShrink: 0 }} /> Used by families, attorneys, journalists, and concerned individuals to locate incarceration records.
              </p>
            </>
          )}

          {step === 'searching-one' && <Searching title="Searching jails &amp; prisons…" P={P} />}
          {step === 'location' && (
            <div>
              <h2 style={h2}>Which state?</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: P.mut }}>State helps us locate the inmate. Adding a city improves the results.</p>
              <label style={label}>State</label>
              <select style={{ ...input, marginBottom: '1rem', borderColor: locationError ? '#fca5a5' : P.line }} value={state} onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }}>
                {US_STATES.map((o) => <option key={o.value} value={o.value} style={{ color: '#111' }}>{o.label}</option>)}
              </select>
              {locationError && <p style={{ color: '#fca5a5', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{locationError}</p>}
              <label style={label}>City (optional)</label>
              <input style={{ ...input, marginBottom: '1rem' }} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              <button type="button" style={cta} onClick={continueFromLocation}>Continue</button>
            </div>
          )}
          {step === 'searching-two' && <Searching title={`Finding inmate matches for ${firstName} ${lastName}…`} P={P} />}
          {step === 'details' && (
            <div>
              <h2 style={h2}>Inmate matches found</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: P.mut }}>A few more details help us surface the exact person.</p>
              <label style={label}>Age (optional)</label>
              <input style={{ ...input, marginBottom: '0.7rem' }} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
              <label style={label}>Middle name (optional)</label>
              <input style={{ ...input, marginBottom: '1rem' }} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name" />
              <button type="button" style={cta} onClick={continueFromDetails}>Continue</button>
              <button type="button" style={btnGhost} onClick={continueFromDetails}>Skip</button>
            </div>
          )}
          {step === 'confirm' && (
            <div>
              <h2 style={h2}>Confirm to view inmate results</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: P.mut }}>Because this information can be misused, we ask every searcher to confirm they&apos;ll use it responsibly.</p>
              <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.84rem', marginBottom: '1rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} />
                <span>I will not use {brand.name} information for employment, insurance, tenant screening, consumer credit, or any purpose restricted by the FCRA.</span>
              </label>
              {agreeError && <p style={{ color: '#fca5a5', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{agreeError}</p>}
              <button type="button" style={cta} onClick={handleConfirm}>I Agree — View Results</button>
              <button type="button" style={btnGhost} onClick={() => setStep('details')}>Back</button>
            </div>
          )}
          {step === 'final-search' && <Searching title="Searching our database…" P={P} />}
        </div>

        {/* RIGHT — value preview panel (two-column construct kept) */}
        <div style={{ ...cardStyle, flex: '1 1 250px', background: P.panel }}>
          <p style={{ margin: '0 0 0.85rem', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: P.amber }}>What you may find</p>
          {VALUE_PREVIEW.map(([ic, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.5rem 0', borderBottom: `1px solid ${P.line}`, fontSize: '0.88rem' }}>
              <Icon name={ic} style={{ width: 18, height: 18, color: P.amber, flexShrink: 0 }} /><span style={{ color: P.ink }}>{l}</span>
            </div>
          ))}
          <p style={{ margin: '0.85rem 0 0', fontSize: '0.72rem', color: P.mut }}>Sourced from county, state &amp; federal facilities across 50 states.</p>
        </div>
      </div>

      <ColorLandingFooter bg={P.bg0} fg="rgba(255,255,255,0.7)" accent={P.amber} />
    </main>
  );
};

const Searching = ({ title, P }) => (
  <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
    <div style={{ width: 46, height: 46, border: '4px solid rgba(255,255,255,0.12)', borderTopColor: P.amber, borderRadius: '50%', margin: '0 auto 1.1rem', animation: 'spin 0.8s linear infinite' }} />
    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: P.ink }} dangerouslySetInnerHTML={{ __html: title }} />
    <p style={{ margin: '0.6rem 0 0', fontSize: '0.85rem', color: P.mut }}>✓ County jails ✓ State prisons ✓ Federal facilities</p>
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
  </div>
);

export default NameSearchLandingV3bPage;
