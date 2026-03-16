import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';
import styles from './NameSearchLandingV3Page.module.css';

/** Step index for progress bar (1–3). Interstitials and final-search don't show a step. */
const getStepIndex = (step) => {
  switch (step) {
    case 'phone': return 1;
    case 'location': return 2;
    case 'confirm': return 3;
    default: return 0;
  }
};

const TOTAL_STEPS = 3;

const TRUST_BADGES = [
  { label: 'Missed Calls', icon: '📱' },
  { label: 'Spam Detection', icon: '🚫' },
  { label: '12B+ Records', icon: '📋' },
  { label: 'Secure', icon: '🔒' },
];

const BENEFIT_BULLETS = [
  'Identify unknown callers',
  'Detect robocalls & scams',
  "Get caller's name & address",
  'Block spam effectively',
];

const formatPhone = (digits) => {
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

/**
 * Phone search landing v3 – Unknown Caller / Who Called Me.
 * 3-step flow: Phone → Location → Confirm → Results.
 */
const PhoneSearchLandingV3Page = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const [phone, setPhone] = useState('');
  const [state, setState] = useState(queryParams.get('state') || '');
  const [step, setStep] = useState('phone');
  const [agree, setAgree] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [agreeError, setAgreeError] = useState('');
  const [finalStatus, setFinalStatus] = useState('Searching our database...');
  const [finalProgress, setFinalProgress] = useState(0);

  const usStates = [
    { value: '', label: 'Select state (optional)' },
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
    { value: 'WY', label: 'Wyoming' },
  ];

  const stepIndex = getStepIndex(step);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  useEffect(() => {
    let timer;
    if (step === 'searching-one') {
      timer = setTimeout(() => setStep('location'), 1700);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [step]);

  useEffect(() => {
    if (step !== 'final-search') return;

    let progressTimer;
    let isCancelled = false;

    const runSearch = async () => {
      try {
        setFinalStatus('Scanning caller databases...');
        setFinalProgress(10);

        progressTimer = setInterval(() => {
          setFinalProgress((prev) => (prev >= 90 ? prev : prev + 10));
        }, 200);

        const response = await api.searchPeople({ phone, type: 'phone' });

        if (isCancelled) return;

        clearInterval(progressTimer);
        setFinalProgress(100);
        setFinalStatus('Search complete!');

        const mappedResults = (response.data || []).map((r) => ({
          ...r,
          id: r.id || r.extId,
          extId: r.extId || r.id,
          fullName: r.fullName || 'Unknown',
          location: r.location || '',
          ageRange: r.ageRange || '',
        }));

        sessionStorage.setItem(
          'phoneSearchResults',
          JSON.stringify({
            results: mappedResults,
            query: { phone },
            searchContext: response.searchContext || {},
            pagination: response.pagination || {},
          })
        );

        if (response.searchContext) setSearchContext(response.searchContext);

        setTimeout(() => navigate('/phone/search-result'), 400);
      } catch (error) {
        console.error('Search error:', error);
        if (isCancelled) return;
        setFinalStatus('Error occurred. Redirecting...');
        setTimeout(() => navigate('/phone/search-result?error=true'), 1500);
      }
    };

    runSearch();

    return () => {
      isCancelled = true;
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [step, phone, navigate]);

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
  };

  const startSearch = (e) => {
    e.preventDefault();
    setPhoneError('');
    if (phone.length < 10) {
      setPhoneError('Please enter a valid 10-digit US phone number.');
      return;
    }
    setStep('searching-one');
  };

  const continueFromLocation = () => setStep('confirm');

  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) {
      setAgreeError('You must agree before continuing.');
      return;
    }
    setStep('final-search');
  };

  return (
    <main className={styles.main}>
      <div className={styles.wrapper}>
        <p className={styles.pageSubtitle}>
          <span className={styles.pageSubtitleIcon} aria-hidden>📱</span> Unknown Caller Lookup
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
          <h1 className={styles.title}>Who Called Me?</h1>
          <p className={styles.subtitle}>
            Enter the number that called you and find out who it belongs to in seconds.
          </p>

          {stepIndex >= 1 && stepIndex <= TOTAL_STEPS && (
            <div className={styles.progressSection}>
              <p className={styles.progressLabel}>Step {stepIndex} of {TOTAL_STEPS}</p>
              <div className={styles.progressBar} role="progressbar" aria-valuenow={stepIndex} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
                <div className={styles.progressFill} style={{ width: `${(stepIndex / TOTAL_STEPS) * 100}%` }} />
              </div>
            </div>
          )}

          {/* Step 1: Phone */}
          {step === 'phone' && (
            <form className={styles.form} onSubmit={startSearch}>
              <h2 className={styles.sectionTitle}>Enter the Number That Called You</h2>
              <p className={styles.helperText}>We&apos;ll identify who called and whether it&apos;s spam or a scam.</p>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v3-phone">Phone Number</label>
                <input
                  id="v3-phone"
                  type="tel"
                  className={styles.input}
                  value={formatPhone(phone)}
                  onChange={handlePhoneChange}
                  placeholder="(555) 555-5555"
                  inputMode="numeric"
                />
              </div>

              {phoneError && <p className={styles.errorText}>{phoneError}</p>}

              <div className={styles.benefits}>
                {BENEFIT_BULLETS.map((bullet, i) => (
                  <span key={i} className={styles.benefitBullet}>{bullet}</span>
                ))}
              </div>

              <div className={styles.actions}>
                <button type="submit" className={styles.buttonPrimary} disabled={phone.length < 10}>
                  Identify Caller
                </button>
              </div>
            </form>
          )}

          {/* Searching interstitial */}
          {step === 'searching-one' && (
            <div className={styles.searching}>
              <div className={styles.spinner} />
              <h2 className={styles.sectionTitle}>Searching</h2>
              <p className={styles.helperText}>Scanning caller databases...</p>
              <ul className={styles.searchList}>
                <li>Caller identity</li>
                <li>Spam &amp; scam databases</li>
                <li>Carrier records</li>
                <li>Public records</li>
              </ul>
            </div>
          )}

          {/* Step 2: Location */}
          {step === 'location' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Do You Know What State They&apos;re Calling From?</h2>
              <p className={styles.helperText}>Optional — helps us narrow results faster.</p>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="v3-state">State (optional)</label>
                <select
                  id="v3-state"
                  className={styles.select}
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  {usStates.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={continueFromLocation}>
                  Continue
                </button>
                <button type="button" className={styles.buttonSecondary} onClick={continueFromLocation}>
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && (
            <div className={styles.form}>
              <h2 className={styles.sectionTitle}>Ready to View Results</h2>
              <p className={styles.helperText}>
                Please confirm before we show your results. IDlookup.ai reports are not for employment, tenant screening, credit, or other FCRA purposes.
              </p>

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  I will not use information from IDlookup.ai for employment, insurance, tenant screening,
                  consumer credit, or any other purpose restricted by the Fair Credit Reporting Act (FCRA).
                </span>
              </label>

              {agreeError && <p className={styles.errorText}>{agreeError}</p>}

              <div className={styles.actions}>
                <button type="button" className={styles.buttonPrimary} onClick={handleConfirm}>
                  I Agree – View Results
                </button>
                <button type="button" className={styles.buttonSecondary} onClick={() => setStep('location')}>
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
                <li>Caller identity</li>
                <li>Spam &amp; scam databases</li>
                <li>Carrier records</li>
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

export default PhoneSearchLandingV3Page;
