import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import styles from './NameSearchLandingV5Page.module.css';
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
  { label: 'Alumni Records', icon: '🎓' },
  { label: 'Work History', icon: '💼' },
  { label: '12B+ Records', icon: '📋' },
  { label: 'Verified Data', icon: '✓' },
];

const BENEFIT_BULLETS = [
  'Find former classmates & alumni',
  'Work history & career info',
  'Current contact info & address',
  'Reconnect with old colleagues',
];

/**
 * Name search landing v5 – "Research classmates and colleagues" theme.
 * Professional blue/slate palette for networking and reconnection use case.
 * Same 4-step flow: Name → Location → Details → Confirm → Results.
 */
const NameSearchLandingV5Page = () => {
  const brand = useBrand();
  useLandingTrack('name', 'v5');
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
  const [agreeError, setAgreeError] = useState('');
  const [locationError, setLocationError] = useState('');
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
    if (step === 'searching-one') timer = setTimeout(() => setStep('location'), 1700);
    if (step === 'searching-two') timer = setTimeout(() => setStep('details'), 1700);
    return () => { if (timer) clearTimeout(timer); };
  }, [step]);

  useEffect(() => {
    if (step !== 'final-search') return;

    let progressTimer;
    let isCancelled = false;

    const runSearch = async () => {
      try {
        setFinalStatus('Searching our database...');
        setFinalProgress(10);

        progressTimer = setInterval(() => {
          setFinalProgress((prev) => (prev >= 90 ? prev : prev + 10));
        }, 200);

        const searchParams = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          type: 'name',
          source: 'name-landing-v5',
        };
        if (middleName.trim()) searchParams.middleName = middleName.trim();
        if (age.trim()) searchParams.age = age.trim();
        if (city.trim()) searchParams.city = city.trim();
        if (state.trim()) searchParams.state = state.trim();

        gtmSetSearchInput({
          firstName: searchParams.firstName,
          lastName: searchParams.lastName,
          middleName: searchParams.middleName,
          city: searchParams.city,
          state: searchParams.state,
        });
        const response = await api.searchPeople(searchParams);
        if (isCancelled) return;

        clearInterval(progressTimer);
        setFinalProgress(100);
        setFinalStatus('Search complete!');

        const mappedResults = (response.data || []).map((result) => ({
          ...result,
          id: result.id || result.extId,
          extId: result.extId || result.id,
          fullName: result.fullName || 'Unknown',
          location: result.location || '',
          ageRange: result.ageRange || '',
          provider: result.provider,
        }));

        sessionStorage.setItem('nameSearchResults', JSON.stringify({
          results: mappedResults,
          query: { firstName, lastName, middleName, age, city, state },
          searchContext: response.searchContext || {},
          pagination: response.pagination || {},
        }));

        if (response.searchContext) setSearchContext(response.searchContext);
        setTimeout(() => navigate('/name/search-result'), 400);
      } catch (error) {
        console.error('Search error:', error);
        if (isCancelled) return;
        setFinalStatus('Error occurred. Redirecting...');
        setTimeout(() => navigate('/name/search-result?error=true'), 1500);
      }
    };

    runSearch();
    return () => {
      isCancelled = true;
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [step, firstName, lastName, middleName, age, city, state, navigate]);

  const startSearch = (e) => {
    e.preventDefault();
    setNameError('');
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('Please enter a first and last name to search.');
      return;
    }
    setStep('searching-one');
  };

  const continueFromLocation = () => {
    // State is required on every name landing.
    if (!state.trim()) { setLocationError('Please select a state before continuing.'); return; }
    setLocationError('');
    setStep('searching-two');
  };
  const continueFromDetails = () => setStep('confirm');

  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) { setAgreeError('You must agree before continuing.'); return; }
    setStep('final-search');
  };

  return (
    <main className={styles.main}>
      <div className={styles.wrapper}>
        <p className={styles.pageSubtitle}>
          <span className={styles.pageSubtitleIcon} aria-hidden>💼</span> Professional Finder
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
          <h1 className={styles.title}>Research Classmates & Colleagues</h1>
          <p className={styles.subtitle}>
            Reconnect with people from your past. Search alumni records, work histories,
            and contact information to find former classmates and colleagues.
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
              <p className={styles.helperText}>Enter the name of the classmate or colleague you'd like to find.</p>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v5-firstName">First Name</label>
                <input id="v5-firstName" type="text" className={styles.input}
                  value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name" required />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v5-lastName">Last Name</label>
                <input id="v5-lastName" type="text" className={styles.input}
                  value={lastName} onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name" required />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v5-middleName">Middle Name (optional)</label>
                <input id="v5-middleName" type="text" className={styles.input}
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
              <p className={styles.helperText}>Searching professional and alumni records...</p>
              <ul className={styles.searchList}>
                <li>Alumni networks</li>
                <li>Work history</li>
                <li>Contact information</li>
                <li>Public records</li>
              </ul>
            </div>
          )}

          {step === 'location' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Where Did They Work or Study?</h2>
              <p className={styles.helperText}>Providing a location helps us narrow results. Optional — you can skip.</p>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v5-city">City (optional)</label>
                <input id="v5-city" type="text" className={styles.input}
                  value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v5-state">State *</label>
                <select id="v5-state" className={styles.select}
                  value={state}
                  onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }}
                  aria-invalid={!!locationError}
                  style={locationError ? { borderColor: '#b91c1c' } : undefined}>
                  {usStates.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {locationError && <p className={styles.errorText}>{locationError}</p>}
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
              <p className={styles.helperText}>Finding professional matches for {firstName} {lastName}...</p>
              <ul className={styles.searchList}>
                <li>Alumni directories</li>
                <li>Professional profiles</li>
                <li>Contact records</li>
              </ul>
            </div>
          )}

          {step === 'details' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Matches Found!</h2>
              <p className={styles.helperText}>Add more details to narrow down the right person. All fields optional.</p>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v5-age">Approximate Age (optional)</label>
                <input id="v5-age" type="text" className={styles.input}
                  value={age} onChange={(e) => setAge(e.target.value)}
                  placeholder="Age" inputMode="numeric" />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v5-middleNameConfirm">Middle Name (optional)</label>
                <input id="v5-middleNameConfirm" type="text" className={styles.input}
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
                not employment screening, credit, or other FCRA purposes.
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
                <li>Alumni networks</li>
                <li>Work history</li>
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

export default NameSearchLandingV5Page;
