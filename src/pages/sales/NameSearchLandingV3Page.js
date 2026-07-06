import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import s from './NameLandingV3Incarceration.module.css';
import { useBrand } from '../../services/brand';

/** Step index for progress bar (1–4). Interstitials and final-search don't show a step. */
const getStepIndex = (step) => {
  switch (step) {
    case 'name': return 1;
    case 'location': return 2;
    case 'details': return 3;
    case 'confirm': return 4;
    default: return 0;
  }
};

const TOTAL_STEPS = 4;

// Inline stroke icons (no emoji — spec). One <svg> chrome, path(s) per name.
const ICON_PATHS = {
  users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></>,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="1" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  scale: <path d="M12 3v18M6 7h12M7 7l-3 6a3 3 0 0 0 6 0l-3-6ZM17 7l-3 6a3 3 0 0 0 6 0l-3-6Z" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" /><circle cx="12" cy="13" r="4" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  eyeOff: <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61M1 1l22 22" />,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></>,
};
const Icon = ({ name, className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON_PATHS[name]}</svg>
);

const VALUE_PREVIEW = [
  ['building', 'Current facility'],
  ['calendar', 'Booking date'],
  ['scale', 'Charges'],
  ['shield', 'Custody status'],
  ['logout', 'Release info'],
  ['building', 'Previous facilities'],
  ['camera', 'Mugshot'],
];

/**
 * Name search landing v3 — incarceration-intent landing (redesign spec 2026-07).
 * Self-chromed (see SELF_CHROME_PREFIXES). Trust-first hero → 4-step wizard.
 * Same 4 steps, same data + tracking: Name → Location → Details → Confirm → Results.
 */
const NameSearchLandingV3Page = () => {
  const brand = useBrand();
  useLandingTrack('name', 'v3');
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [firstName, setFirstName] = useState(queryParams.get('fn') || queryParams.get('firstName') || '');
  const [middleName, setMiddleName] = useState(queryParams.get('mn') || queryParams.get('middleName') || '');
  const [lastName, setLastName] = useState(queryParams.get('ln') || queryParams.get('lastName') || '');
  const [city, setCity] = useState(queryParams.get('city') || '');
  const [state, setState] = useState(queryParams.get('state') || '');
  const [age, setAge] = useState(queryParams.get('age') || '');
  const [step, setStep] = useState('name');
  const [agree, setAgree] = useState(false);
  const [nameError, setNameError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [agreeError, setAgreeError] = useState('');
  const [finalStatus, setFinalStatus] = useState('Searching our database...');
  const [finalProgress, setFinalProgress] = useState(0);

  const usStates = [
    { value: '', label: 'Select a state' },
    { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' }, { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' }, { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' }, { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
  ];

  const stepIndex = getStepIndex(step);

  // Reset scroll to top when step (view) changes so each screen loads at top.
  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  useEffect(() => {
    let timer;
    if (step === 'searching-one') {
      timer = setTimeout(() => { track('search_step', { step: 'location', search_type: 'name', variant: 'v3' }); setStep('location'); }, 1700);
    }
    if (step === 'searching-two') {
      timer = setTimeout(() => { track('search_step', { step: 'details', search_type: 'name', variant: 'v3' }); setStep('details'); }, 1700);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [step]);

  // Search invoked directly from handleConfirm — NOT a useEffect. Effect-based
  // dispatch silently drops the search (see NameSearchLandingV5Page.js).
  const runSearch = () => {
    setFinalStatus('Searching our database...');
    setFinalProgress(60);
    gtmSetSearchInput({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName.trim(),
      city: city.trim(),
      state: state.trim(),
    });
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
    e.preventDefault();
    setNameError('');
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('Please enter a first and last name to search.'); track('validation_error', { reason: 'name_required', step: 'name' });
      return;
    }
    track('search_step', { step: 'searching-one', search_type: 'name', variant: 'v3' });
    setStep('searching-one');
  };

  const continueFromLocation = () => {
    if (!state.trim()) { setLocationError('Please select a state before continuing.'); track('validation_error', { reason: 'state_required', step: 'location' }); return; }
    setLocationError('');
    track('search_step', { step: 'searching-two', search_type: 'name', variant: 'v3' });
    setStep('searching-two');
  };
  const continueFromDetails = () => { track('search_step', { step: 'confirm', search_type: 'name', variant: 'v3' }); setStep('confirm'); };

  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) {
      setAgreeError('You must agree before continuing.'); track('validation_error', { reason: 'fcra_not_agreed', step: 'confirm' });
      return;
    }
    track('search_step', { step: 'final-search', search_type: 'name', variant: 'v3' });
    track('fcra_agree', { search_type: 'name', variant: 'v3' });
    setStep('final-search');
    runSearch();
  };

  return (
    <main className={s.page}>
      {/* self-chrome minimal header (spec: no Login / Sign Up) */}
      <header className={s.nav}>
        <a href="/" className={s.logo}>{brand.name}</a>
        <nav className={s.navLinks}>
          <a href="/privacy" className={s.navLink}>Privacy</a>
          <a href="/contact" className={s.navLink}>Support</a>
        </nav>
      </header>

      <div className={s.wrapper}>
        {/* HERO — trust-first, on the entry step */}
        {step === 'name' && (
          <div className={s.hero}>
            <h1 className={s.headline}>Find Someone in Jail or Prison</h1>
            <p className={s.sub}>Search current and historical incarceration records from correctional facilities and public-record sources.</p>
            <p className={s.trustLine}><Icon name="lock" className={s.vpChipIcon} /> Results in Seconds</p>
          </div>
        )}

        <div className={s.card}>
          {/* redesigned segmented progress (steps 2–4) */}
          {stepIndex >= 2 && stepIndex <= TOTAL_STEPS && (
            <div className={s.progress}>
              <p className={s.progressLabel}>Step {stepIndex} of {TOTAL_STEPS}</p>
              <div className={s.progressTrack} role="progressbar" aria-valuenow={stepIndex} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className={`${s.progressSeg} ${n <= stepIndex ? s.progressSegOn : ''}`} />
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Name */}
          {step === 'name' && (
            <>
              <ul className={s.benefits}>
                <li className={s.benefit}><Icon name="users" className={s.benefitIcon} /><span>Reconnect with an incarcerated friend or family member</span></li>
                <li className={s.benefit}><Icon name="pin" className={s.benefitIcon} /><span>Find out where they&apos;re held — and what comes next</span></li>
                <li className={s.benefit}><Icon name="search" className={s.benefitIcon} /><span>A comprehensive scan of jails, prisons &amp; public records</span></li>
              </ul>

              <form className={s.form} onSubmit={startSearch}>
                <div className={s.nameRow}>
                  <div className={s.field}>
                    <label className={s.label} htmlFor="v3-firstName">First name</label>
                    <input id="v3-firstName" type="text" className={s.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" required />
                  </div>
                  <div className={s.field}>
                    <label className={s.label} htmlFor="v3-lastName">Last name</label>
                    <input id="v3-lastName" type="text" className={s.input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" required />
                  </div>
                </div>

                <details className={s.advanced} open={!!middleName}>
                  <summary className={s.advancedSummary}>+ Advanced search</summary>
                  <div className={s.advancedBody}>
                    <div className={s.field}>
                      <label className={s.label} htmlFor="v3-middleName">Middle name (optional)</label>
                      <input id="v3-middleName" type="text" className={s.input} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Michael" />
                    </div>
                  </div>
                </details>

                {nameError && <p className={s.errorText}>{nameError}</p>}

                {/* Value preview — the payoff, ABOVE the CTA (spec) */}
                <div className={s.valuePreview}>
                  <p className={s.vpLabel}>What you may find</p>
                  <div className={s.vpGrid}>
                    {VALUE_PREVIEW.map(([ic, label]) => (
                      <span key={label} className={s.vpChip}><Icon name={ic} className={s.vpChipIcon} />{label}</span>
                    ))}
                  </div>
                </div>

                <button type="submit" className={s.cta}><Icon name="search" className={s.ctaIcon} /> Search Records</button>
              </form>

              <p className={s.social}>Used by families, attorneys, journalists, and concerned individuals to locate incarceration records.</p>
            </>
          )}

          {/* Searching interstitial 1 */}
          {step === 'searching-one' && (
            <div className={s.searching}>
              <div className={s.spinner} />
              <h2 className={s.sectionTitle}>Searching</h2>
              <p className={s.helper}>Searching jails and prisons…</p>
              <ul className={s.searchList}>
                <li>County jails</li><li>State prisons</li><li>Federal facilities</li><li>Inmate records</li>
              </ul>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 'location' && (
            <div className={s.form}>
              <h2 className={s.sectionTitle}>Which state?</h2>
              <p className={s.helper}>State narrows the search to county jails and state prisons. City is optional.</p>
              <div className={s.field}>
                <label className={s.label} htmlFor="v3-city">City (optional)</label>
                <input id="v3-city" type="text" className={s.input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="v3-state">State</label>
                <select id="v3-state" className={s.select} value={state} onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }} aria-invalid={!!locationError} style={locationError ? { borderColor: '#b91c1c' } : undefined}>
                  {usStates.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                </select>
                {locationError && <p className={s.errorText} role="alert">{locationError}</p>}
              </div>
              <div className={s.actions}>
                <button type="button" className={s.cta} onClick={continueFromLocation}>Continue</button>
              </div>
            </div>
          )}

          {/* Searching interstitial 2 */}
          {step === 'searching-two' && (
            <div className={s.searching}>
              <div className={s.spinner} />
              <h2 className={s.sectionTitle}>Searching</h2>
              <p className={s.helper}>Finding inmate matches for {firstName} {lastName}…</p>
              <ul className={s.searchList}>
                <li>Matching facilities</li><li>Checking inmate records</li><li>County &amp; state databases</li>
              </ul>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 'details' && (
            <div className={s.form}>
              <h2 className={s.sectionTitle}>Possible inmate matches found</h2>
              <p className={s.helper}>Add age or middle name to narrow results. All fields optional.</p>
              <div className={s.field}>
                <label className={s.label} htmlFor="v3-age">Age (optional)</label>
                <input id="v3-age" type="text" className={s.input} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="v3-middleNameConfirm">Middle name (optional)</label>
                <input id="v3-middleNameConfirm" type="text" className={s.input} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name" />
              </div>
              <div className={s.actions}>
                <button type="button" className={s.cta} onClick={continueFromDetails}>Continue</button>
                <button type="button" className={s.buttonSecondary} onClick={continueFromDetails}>Skip</button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && (
            <div className={s.form}>
              <h2 className={s.sectionTitle}>Confirm to view inmate results</h2>
              <p className={s.helper}>Please confirm before we show your results. {brand.name} reports are not for employment, tenant screening, credit, or other FCRA purposes.</p>
              <label className={s.checkboxRow}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I will not use information from {brand.name} for employment, insurance, tenant screening, consumer credit, or any other purpose restricted by the Fair Credit Reporting Act (FCRA).</span>
              </label>
              {agreeError && <p className={s.errorText}>{agreeError}</p>}
              <div className={s.actions}>
                <button type="button" className={s.cta} onClick={handleConfirm}>I Agree — View Results</button>
                <button type="button" className={s.buttonSecondary} onClick={() => setStep('details')}>Back</button>
              </div>
            </div>
          )}

          {/* Final search */}
          {step === 'final-search' && (
            <div className={s.searching}>
              <div className={s.spinner} />
              <h2 className={s.sectionTitle}>Searching</h2>
              <p className={s.helper}>{finalStatus}</p>
              <ul className={s.searchList}>
                <li>County jails</li><li>State prisons</li><li>Federal facilities</li><li>Inmate records</li>
              </ul>
              <p className={s.helper}>{finalProgress}% complete</p>
            </div>
          )}
        </div>
      </div>

      {/* minimal footer (spec) */}
      <footer className={s.footer}>
        <div className={s.footerLinks}>
          <a href="/privacy" className={s.footerLink}>Privacy Policy</a>
          <a href="/terms" className={s.footerLink}>Terms</a>
          <a href="/contact" className={s.footerLink}>Contact</a>
          <a href="/contact" className={s.footerLink}>Support</a>
        </div>
        <p className={s.fcra}>{brand.name} is not a consumer reporting agency as defined by the Fair Credit Reporting Act (FCRA). Do not use this site for employment, tenant screening, credit, or any other FCRA-regulated purpose.</p>
      </footer>
    </main>
  );
};

export default NameSearchLandingV3Page;
