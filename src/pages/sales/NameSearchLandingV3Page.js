import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import styles from './NameSearchLandingV3Page.module.css';
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

/* Inmate-locator themed: trust badges and benefit bullets */
const TRUST_BADGES = [
  { label: 'Jails & Prisons', icon: '🏛️' },
  { label: '12B+ Records', icon: '📋' },
  { label: 'Secure Search', icon: '🔒' },
];

const BENEFIT_BULLETS = [
  'County jails & state prisons',
  'Current facility & location',
  'Booking & release info',
  'Inmate ID & status',
];

/**
 * Name search landing v3 – inmate-search themed flow with progress bar,
 * single-column layout, trust badges, and benefit bullets.
 * Same 4 steps, same data: Name → Location → Details → Confirm → Results.
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
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' }
  ];

  const stepIndex = getStepIndex(step);

  // Reset scroll to top when step (view) changes so each screen loads at top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    let timer;
    if (step === 'searching-one') {
      timer = setTimeout(() => { track('search_step', { step: 'location', search_type: 'name', variant: 'v3' }); setStep('location'); }, 1700);
    }
    if (step === 'searching-two') {
      timer = setTimeout(() => { track('search_step', { step: 'details', search_type: 'name', variant: 'v3' }); setStep('details'); }, 1700);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [step]);

  // Search invoked directly from handleConfirm — NOT a useEffect. See
  // NameSearchLandingV5Page.js for the explanation of why effect-based
  // dispatch silently drops the search.
  const runSearch = () => {
    // Delegate the actual search to /name/loader — the reliable path that V1 and
    // /search/all use. V3's prior inline api.searchPeople could fail silently
    // (no HTTP call, then redirect to ?error=true). Handing off keeps the
    // inmate-themed entry wizard but a search execution path that works.
    setFinalStatus('Searching our database...');
    setFinalProgress(60);
    gtmSetSearchInput({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleName: middleName.trim(),
      city: city.trim(),
      state: state.trim(),
    });
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
    e.preventDefault();
    setNameError('');
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('Please enter a first and last name to search.');
      return;
    }
    track('search_step', { step: 'searching-one', search_type: 'name', variant: 'v3' });
    setStep('searching-one');
  };

  const continueFromLocation = () => {
    if (!state.trim()) { setLocationError('Please select a state before continuing.'); return; }
    setLocationError('');
    track('search_step', { step: 'searching-two', search_type: 'name', variant: 'v3' });
    setStep('searching-two');
  };
  const continueFromDetails = () => { track('search_step', { step: 'confirm', search_type: 'name', variant: 'v3' }); setStep('confirm'); };

  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) {
      setAgreeError('You must agree before continuing.');
      return;
    }
    track('search_step', { step: 'final-search', search_type: 'name', variant: 'v3' });
    track('fcra_agree', { search_type: 'name', variant: 'v3' });
    setStep('final-search');
    runSearch();
  };

  return (
    <main className={styles.main}>
      <div className={styles.wrapper}>
        <p className={styles.pageSubtitle}><span className={styles.pageSubtitleIcon} aria-hidden>🔍</span> Inmate Locator</p>
        {/* Trust badges – always visible */}
        <div className={styles.trustBadges}>
          {TRUST_BADGES.map((badge, i) => (
            <span key={i} className={styles.trustBadge}>
              <span className={styles.trustBadgeIcon} aria-hidden>{badge.icon}</span>
              {badge.label}
            </span>
          ))}
        </div>

        {/* Single-column card */}
        <div className={styles.card}>
          <h1 className={styles.title}>Find an Inmate</h1>
          <p className={styles.subtitle}>
            Search county jails, state prisons, and federal facilities. Enter a name to begin.
          </p>

          {/* Visible progress bar – only on the 4 form steps */}
          {stepIndex >= 1 && stepIndex <= TOTAL_STEPS && (
            <div className={styles.progressSection}>
              <p className={styles.progressLabel}>Step {stepIndex} of {TOTAL_STEPS}</p>
              <div className={styles.progressBar} role="progressbar" aria-valuenow={stepIndex} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
                <div className={styles.progressFill} style={{ width: `${(stepIndex / TOTAL_STEPS) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Step 1: Name */}
          {step === 'name' && (
            <form className={styles.form} onSubmit={startSearch}>
              <h2 className={styles.sectionTitle}>Enter the Inmate&apos;s Name</h2>
              <p className={styles.helperText}>Enter first and last name to search jails and prisons nationwide.</p>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v3-firstName">First Name</label>
                <input
                  id="v3-firstName"
                  type="text"
                  className={styles.input}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First (ex. John)"
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v3-lastName">Last Name</label>
                <input
                  id="v3-lastName"
                  type="text"
                  className={styles.input}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last (ex. Smith)"
                  required
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v3-middleName">Middle Name (optional)</label>
                <input
                  id="v3-middleName"
                  type="text"
                  className={styles.input}
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Middle name"
                />
              </div>

              {nameError && <p className={styles.errorText}>{nameError}</p>}

              <div className={styles.benefits}>
                {BENEFIT_BULLETS.map((bullet, i) => (
                  <span key={i} className={styles.benefitBullet}>{bullet}</span>
                ))}
              </div>

              <div className={styles.actions}>
                <button type="submit" className={styles.buttonPrimary}>Search</button>
              </div>
            </form>
          )}

          {/* Searching interstitial 1 */}
          {step === 'searching-one' && (
            <div className={styles.searching}>
              <div className={styles.spinner} />
              <h2 className={styles.sectionTitle}>Searching</h2>
              <p className={styles.helperText}>Searching jails and prisons...</p>
              <ul className={styles.searchList}>
                <li>County jails</li>
                <li>State prisons</li>
                <li>Federal facilities</li>
                <li>Inmate records</li>
              </ul>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 'location' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Which State?</h2>
              <p className={styles.helperText}>State narrows the search to county jails and state prisons. City is optional.</p>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v3-city">City (optional)</label>
                <input
                  id="v3-city"
                  type="text"
                  className={styles.input}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v3-state">State *</label>
                <select
                  id="v3-state"
                  className={styles.select}
                  value={state}
                  onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }}
                  aria-invalid={!!locationError}
                  style={locationError ? { borderColor: '#b91c1c' } : undefined}
                >
                  {usStates.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {locationError && (
                  <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0.4rem 0 0' }} role="alert">{locationError}</p>
                )}
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={continueFromLocation}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Searching interstitial 2 */}
          {step === 'searching-two' && (
            <div className={styles.searching}>
              <div className={styles.spinner} />
              <h2 className={styles.sectionTitle}>Searching</h2>
              <p className={styles.helperText}>Finding inmate matches for {firstName} {lastName}...</p>
              <ul className={styles.searchList}>
                <li>Matching facilities</li>
                <li>Checking inmate records</li>
                <li>County &amp; state databases</li>
              </ul>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 'details' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Possible Inmate Matches Found</h2>
              <p className={styles.helperText}>Add age or middle name to narrow results. All fields optional.</p>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v3-age">Age (optional)</label>
                <input
                  id="v3-age"
                  type="text"
                  className={styles.input}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="Age"
                  inputMode="numeric"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v3-middleNameConfirm">Middle name (optional)</label>
                <input
                  id="v3-middleNameConfirm"
                  type="text"
                  className={styles.input}
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Middle name"
                />
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={continueFromDetails}>
                  Continue
                </button>
                <button type="button" className={styles.buttonSecondary} onClick={continueFromDetails}>
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 'confirm' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Confirm to View Inmate Results</h2>
              <p className={styles.helperText}>
                Please confirm before we show your results. {brand.name} reports are not for employment, tenant screening, credit, or other FCRA purposes.
              </p>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  I will not use information from {brand.name} for employment, insurance, tenant screening,
                  consumer credit, or any other purpose restricted by the Fair Credit Reporting Act (FCRA).
                </span>
              </label>

              {agreeError && <p className={styles.errorText}>{agreeError}</p>}

              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={handleConfirm}>
                  I Agree – View Results
                </button>
                <button type="button" className={styles.buttonSecondary} onClick={() => setStep('details')}>
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Final search */}
          {step === 'final-search' && (
            <div className={styles.searching}>
              <div className={styles.spinner} />
              <h2 className={styles.sectionTitle}>Searching</h2>
              <p className={styles.helperText}>{finalStatus}</p>
              <ul className={styles.searchList}>
                <li>County jails</li>
                <li>State prisons</li>
                <li>Federal facilities</li>
                <li>Inmate records</li>
              </ul>
              <p className={styles.helperText}>{finalProgress}% complete</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default NameSearchLandingV3Page;
