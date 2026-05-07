import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import styles from './NameSearchLandingV2Page.module.css';
import { useBrand } from '../../services/brand';

const NameSearchLandingV2Page = () => {
  const brand = useBrand();
  useLandingTrack('name', 'v2');
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
    { value: '', label: 'All States' },
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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    let timer;
    if (step === 'searching-one') {
      timer = setTimeout(() => setStep('location'), 1700);
    }
    if (step === 'searching-two') {
      timer = setTimeout(() => setStep('details'), 1700);
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [step]);

  useEffect(() => {
    if (step !== 'final-search') {
      return;
    }

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
          type: 'name',
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleName: middleName.trim(),
          age: age.trim(),
          city: city.trim(),
          state: state.trim(),
          source: 'name-landing-v2'
        };

        const response = await api.searchPeople(searchParams);

        if (isCancelled) {
          return;
        }

        clearInterval(progressTimer);
        setFinalProgress(100);
        setFinalStatus('Search complete!');

        const mappedResults = (response.data || []).map(result => ({
          ...result,
          id: result.id || result.extId,
          extId: result.extId,
          fullName: result.fullName || 'Unknown',
          location: result.location || '',
          ageRange: result.ageRange || '',
          provider: result.provider
        }));

        sessionStorage.setItem('nameSearchResults', JSON.stringify({
          results: mappedResults,
          query: { firstName, lastName, middleName, age, city, state },
          searchContext: response.searchContext || {},
          pagination: response.pagination || {}
        }));

        if (response.searchContext) {
          setSearchContext(response.searchContext);
        }

        setTimeout(() => {
          navigate('/name/search-result');
        }, 400);
      } catch (error) {
        console.error('Search error:', error);
        if (isCancelled) {
          return;
        }
        setFinalStatus('Error occurred. Redirecting...');
        setTimeout(() => {
          navigate('/name/search-result?error=true');
        }, 1500);
      }
    };

    runSearch();

    return () => {
      isCancelled = true;
      if (progressTimer) {
        clearInterval(progressTimer);
      }
    };
  }, [step, firstName, lastName, middleName, age, city, state, navigate]);

  const startSearch = (event) => {
    event.preventDefault();
    setNameError('');
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('Please enter a first and last name.');
      return;
    }
    setStep('searching-one');
  };

  const continueFromLocation = () => {
    // State is required on every name landing — first+last alone returns
    // unreliable BC matches.
    if (!state.trim()) {
      setLocationError('Please select a state before continuing.');
      return;
    }
    setLocationError('');
    setStep('searching-two');
  };

  const continueFromDetails = () => {
    setStep('confirm');
  };

  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) {
      setAgreeError('You must agree before continuing.');
      return;
    }
    setStep('final-search');
  };

  const stepLabel = (() => {
    switch (step) {
      case 'name':
        return 'Step 1 of 4';
      case 'location':
        return 'Step 2 of 4';
      case 'details':
        return 'Step 3 of 4';
      case 'confirm':
        return 'Step 4 of 4';
      default:
        return 'Processing';
    }
  })();

  return (
    <main className={styles.main}>
      <section className={styles.wrapper}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.stepBadge}>{stepLabel}</span>
            <h1 className={styles.title}>Find Anyone Fast</h1>
            <p className={styles.subtitle}>
              Search billions of public records with the {brand.name} people finder.
            </p>
          </div>

          {step === 'name' && (
            <form className={styles.form} onSubmit={startSearch}>
              <h2 className={styles.sectionTitle}>Enter a Name to Begin</h2>
              <div className={styles.fieldGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="firstName">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    className={styles.input}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="First (ex. John)"
                    required
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="lastName">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    className={styles.input}
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last (ex. Smith)"
                    required
                  />
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="middleName">
                  Middle Name (Optional)
                </label>
                <input
                  id="middleName"
                  type="text"
                  className={styles.input}
                  value={middleName}
                  onChange={(event) => setMiddleName(event.target.value)}
                  placeholder="Middle name"
                />
              </div>

              {nameError && <p className={styles.errorText}>{nameError}</p>}

              <div className={styles.actions}>
                <button type="submit" className={styles.buttonPrimary}>
                  Begin Search
                </button>
              </div>
            </form>
          )}

          {step === 'searching-one' && (
            <div className={styles.searching}>
              <div className={styles.spinner} />
              <h2 className={styles.sectionTitle}>Searching</h2>
              <p className={styles.helperText}>Looking up billions of records...</p>
              <div className={styles.searchList}>
                <span>Possible relatives</span>
                <span>Job &amp; education</span>
                <span>Person information</span>
                <span>Contact information</span>
                <span>Social media profiles</span>
              </div>
            </div>
          )}

          {step === 'location' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Thank you. Where do they live?</h2>
              <div className={styles.fieldGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="city">
                    City (Optional)
                  </label>
                  <input
                    id="city"
                    type="text"
                    className={styles.input}
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="state">
                    State *
                  </label>
                  <select
                    id="state"
                    className={styles.select}
                    value={state}
                    onChange={(event) => { setState(event.target.value); if (locationError) setLocationError(''); }}
                    aria-invalid={!!locationError}
                    style={locationError ? { borderColor: '#b91c1c' } : undefined}
                  >
                    {usStates.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {locationError && (
                    <p role="alert" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#b91c1c' }}>{locationError}</p>
                  )}
                </div>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={continueFromLocation}>
                  Continue
                </button>
                {/* "Skip This Step" cannot be offered for a required field — partner feedback bug 12 */}
              </div>
            </div>
          )}

          {step === 'searching-two' && (
            <div className={styles.searching}>
              <div className={styles.spinner} />
              <h2 className={styles.sectionTitle}>Searching</h2>
              <p className={styles.helperText}>Narrowing results for {firstName} {lastName}...</p>
              <div className={styles.searchList}>
                <span>Checking address history</span>
                <span>Matching phone numbers</span>
                <span>Scanning social profiles</span>
                <span>Compiling public records</span>
              </div>
            </div>
          )}

          {step === 'details' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Great, we found matches</h2>
              <p className={styles.helperText}>
                Add a few more details to get faster, more possible results. Let's go!
              </p>
              <div className={styles.fieldGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="age">
                    Age (Optional)
                  </label>
                  <input
                    id="age"
                    type="text"
                    className={styles.input}
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    placeholder="Age"
                    inputMode="numeric"
                  />
                </div>
              </div>
              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={continueFromDetails}>
                  Continue
                </button>
                <button type="button" className={styles.buttonSecondary} onClick={continueFromDetails}>
                  Skip This Step
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Please confirm before we continue</h2>
              <p className={styles.helperText}>
                There are limits to how you can use {brand.name} reports.
              </p>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(event) => setAgree(event.target.checked)}
                />
                <span>
                  I will not use information provided by {brand.name} for employment, insurance, tenant screening,
                  consumer credit, or any other purpose restricted by the Fair Credit Reporting Act (FCRA).
                </span>
              </label>
              {agreeError && <p className={styles.errorText}>{agreeError}</p>}
              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={handleConfirm}>
                  I Agree
                </button>
                <button type="button" className={styles.buttonSecondary} onClick={() => setStep('details')}>
                  Back
                </button>
              </div>
            </div>
          )}

          {step === 'final-search' && (
            <div className={styles.searching}>
              <div className={styles.spinner} />
              <h2 className={styles.sectionTitle}>Searching</h2>
              <p className={styles.helperText}>{finalStatus}</p>
              <div className={styles.searchList}>
                <span>Possible relatives</span>
                <span>Job &amp; education</span>
                <span>Person information</span>
                <span>Contact information</span>
                <span>Social media profiles</span>
              </div>
              <p className={styles.helperText}>{finalProgress}% complete</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default NameSearchLandingV2Page;
