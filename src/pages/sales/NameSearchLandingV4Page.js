import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import styles from './NameSearchLandingV4Page.module.css';
import { useBrand } from '../../services/brand';

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

const TRUST_BADGES = [
  { label: 'Family Records', icon: '👨‍👩‍👧' },
  { label: '12B+ Records', icon: '📋' },
  { label: 'Address History', icon: '🏠' },
];

const BENEFIT_BULLETS = [
  'Find living relatives nationwide',
  'Current address & contact info',
  'Birth, marriage & family records',
  'Reconnect with lost loved ones',
];

/**
 * Name search landing v4 – "Reconnect with lost relatives and family members" theme.
 * Warm amber tone, emotionally resonant copy.
 * Same 4-step flow: Name → Location → Details → Confirm → Results.
 */
const NameSearchLandingV4Page = () => {
  const brand = useBrand();
  useLandingTrack('name', 'v4');
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
    { value: '', label: 'Select state (optional)' },
    { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
  ];

  const stepIndex = getStepIndex(step);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    let timer;
    if (step === 'searching-one') timer = setTimeout(() => { track('search_step', { step: 'location', search_type: 'name', variant: 'v4' }); setStep('location'); }, 1700);
    if (step === 'searching-two') timer = setTimeout(() => { track('search_step', { step: 'details', search_type: 'name', variant: 'v4' }); setStep('details'); }, 1700);
    return () => { if (timer) clearTimeout(timer); };
  }, [step]);

  // Search invoked directly from handleConfirm (below) — NOT a useEffect.
  // Previous implementation ran search inside an effect whose cleanup set
  // isCancelled=true on the in-flight promise, dropping results silently.
  // See NameSearchLandingV5Page.js for the same pattern + explanation.
  const runSearch = () => {
    // Delegate the actual search to /name/loader — the reliable path that V1/V3 and
    // /search/all use. The prior inline api.searchPeople could fail silently (no HTTP
    // call, then redirect to ?error=true). Handing off keeps the death-themed entry
    // wizard but a search execution path that works. (Mirrors the V3 fix.)
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
    track('search_step', { step: 'searching-one', search_type: 'name', variant: 'v4' });
    setStep('searching-one');
  };

  const continueFromLocation = () => {
    if (!state.trim()) { setLocationError('Please select a state before continuing.'); return; }
    setLocationError('');
    track('search_step', { step: 'searching-two', search_type: 'name', variant: 'v4' });
    setStep('searching-two');
  };
  const continueFromDetails = () => { track('search_step', { step: 'confirm', search_type: 'name', variant: 'v4' }); setStep('confirm'); };

  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) { setAgreeError('You must agree before continuing.'); return; }
    track('search_step', { step: 'final-search', search_type: 'name', variant: 'v4' });
    track('fcra_agree', { search_type: 'name', variant: 'v4' });
    setStep('final-search');
    runSearch();
  };

  return (
    <main className={styles.main}>
      <div className={styles.wrapper}>
        <p className={styles.pageSubtitle}>
          <span className={styles.pageSubtitleIcon} aria-hidden>👨‍👩‍👧</span> Family Finder
        </p>

        <div className={styles.trustBadges}>
          {TRUST_BADGES.map((badge, i) => (
            <span key={i} className={styles.trustBadge}>
              <span className={styles.trustBadgeIcon} aria-hidden>{badge.icon}</span>
              {badge.label}
            </span>
          ))}
        </div>

        <div className={styles.card}>
          <h1 className={styles.title}>Find Lost Relatives & Family Members</h1>
          <p className={styles.subtitle}>
            Life takes people in different directions. Our people finder searches billions of public records
            so you can reconnect with the family members who matter most.
          </p>

          {stepIndex >= 1 && stepIndex <= TOTAL_STEPS && (
            <div className={styles.progressSection}>
              <p className={styles.progressLabel}>Step {stepIndex} of {TOTAL_STEPS}</p>
              <div className={styles.progressBar} role="progressbar" aria-valuenow={stepIndex} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
                <div className={styles.progressFill} style={{ width: `${(stepIndex / TOTAL_STEPS) * 100}%` }} />
              </div>
            </div>
          )}

          {step === 'name' && (
            <form className={styles.form} onSubmit={startSearch}>
              <h2 className={styles.sectionTitle}>Who Are You Looking For?</h2>
              <p className={styles.helperText}>Enter the name of the relative you'd like to reconnect with.</p>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v4-firstName">First Name</label>
                <input id="v4-firstName" type="text" className={styles.input}
                  value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First (ex. John)" required />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v4-lastName">Last Name</label>
                <input id="v4-lastName" type="text" className={styles.input}
                  value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last (ex. Smith)" required />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v4-middleName">Middle Name (optional)</label>
                <input id="v4-middleName" type="text" className={styles.input}
                  value={middleName} onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Middle name" />
              </div>

              {nameError && <p className={styles.errorText}>{nameError}</p>}

              <div className={styles.benefits}>
                {BENEFIT_BULLETS.map((bullet, i) => (
                  <span key={i} className={styles.benefitBullet}>{bullet}</span>
                ))}
              </div>

              <div className={styles.actions}>
                <button type="submit" className={styles.buttonPrimary}>Find This Person</button>
              </div>
            </form>
          )}

          {step === 'searching-one' && (
            <div className={styles.searching}>
              <div className={styles.spinner} />
              <h2 className={styles.sectionTitle}>Searching</h2>
              <p className={styles.helperText}>Searching family and relative records...</p>
              <ul className={styles.searchList}>
                <li>Family member records</li>
                <li>Address history</li>
                <li>Contact information</li>
                <li>Public records</li>
              </ul>
            </div>
          )}

          {step === 'location' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Where Did They Last Live?</h2>
              <p className={styles.helperText}>State is required so we can search the right county and state records. City is optional.</p>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v4-city">City (optional)</label>
                <input id="v4-city" type="text" className={styles.input}
                  value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v4-state">State *</label>
                <select id="v4-state" className={styles.select}
                  value={state}
                  onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }}
                  aria-invalid={!!locationError}
                  style={locationError ? { borderColor: '#b91c1c' } : undefined}>
                  {usStates.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {locationError && (
                  <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0.4rem 0 0' }} role="alert">{locationError}</p>
                )}
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={continueFromLocation}>Continue</button>
              </div>
            </div>
          )}

          {step === 'searching-two' && (
            <div className={styles.searching}>
              <div className={styles.spinner} />
              <h2 className={styles.sectionTitle}>Searching</h2>
              <p className={styles.helperText}>Finding matches for {firstName} {lastName}...</p>
              <ul className={styles.searchList}>
                <li>Relatives & family connections</li>
                <li>Current & past addresses</li>
                <li>Phone numbers</li>
              </ul>
            </div>
          )}

          {step === 'details' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Possible Matches Found!</h2>
              <p className={styles.helperText}>Adding more details helps us find the right person. All fields optional.</p>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v4-age">Approximate Age (optional)</label>
                <input id="v4-age" type="text" className={styles.input}
                  value={age} onChange={(e) => setAge(e.target.value)}
                  placeholder="Age" inputMode="numeric" />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v4-middleNameConfirm">Middle Name (optional)</label>
                <input id="v4-middleNameConfirm" type="text" className={styles.input}
                  value={middleName} onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Middle name" />
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={continueFromDetails}>Continue</button>
                <button type="button" className={styles.buttonSecondary} onClick={continueFromDetails}>Skip</button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>One Last Step</h2>
              <p className={styles.helperText}>
                Please confirm before we show your results. {brand.name} reports are for personal use only,
                not employment, tenant screening, credit, or other FCRA purposes.
              </p>
              <label className={styles.checkboxRow}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>
                  I will not use information from {brand.name} for employment, insurance, tenant screening,
                  consumer credit, or any other purpose restricted by the Fair Credit Reporting Act (FCRA).
                </span>
              </label>
              {agreeError && <p className={styles.errorText}>{agreeError}</p>}
              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={handleConfirm}>
                  I Agree – Show Me Results
                </button>
                <button type="button" className={styles.buttonSecondary} onClick={() => setStep('details')}>Back</button>
              </div>
            </div>
          )}

          {step === 'final-search' && (
            <div className={styles.searching}>
              <div className={styles.spinner} />
              <h2 className={styles.sectionTitle}>Searching</h2>
              <p className={styles.helperText}>{finalStatus}</p>
              <ul className={styles.searchList}>
                <li>Family member records</li>
                <li>Address history</li>
                <li>Contact information</li>
                <li>Public records</li>
              </ul>
              <p className={styles.helperText}>{finalProgress}% complete</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default NameSearchLandingV4Page;
