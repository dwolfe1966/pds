import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import s from './NameLandingV3Incarceration.module.css';
import { useBrand } from '../../services/brand';
import US_STATES from './usStates';

/**
 * Config-driven intent landing — the v3 (incarceration) flow generalized so vertical
 * variants (divorce = v12, death = v13, …) reuse the exact same 4-step wizard, chrome,
 * tracking, and search hand-off, changing only the COPY. v3 itself keeps its own file.
 * Same steps + data + tracking: Name → Location → Details → Confirm → Results (/name/loader).
 *
 * cfg fields: variant, idPrefix, headline, benefits[[icon,label]], firstLabel, lastLabel,
 * firstPlaceholder, lastPlaceholder, socialProof, valuePreview[[icon,label]], vpLabel,
 * searchingOneHelper, searchingOneList[], searchingTwoList[], detailsTitle, confirmTitle,
 * finalList[].
 */

const ICON_PATHS = {
  users: <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
  pin: <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></>,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="1" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  scale: <path d="M12 3v18M6 7h12M7 7l-3 6a3 3 0 0 0 6 0l-3-6ZM17 7l-3 6a3 3 0 0 0 6 0l-3-6Z" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
  camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" /><circle cx="12" cy="13" r="4" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></>,
  seal: <><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="m9 12 2 2 4-4" /></>,
  flower: <><circle cx="12" cy="12" r="3" /><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5" /></>,
};
const Icon = ({ name, className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON_PATHS[name] || ICON_PATHS.search}</svg>
);

import DivorceTeaser from '../../components/DivorceTeaser';
import { useFunnelFlow } from '../../services/funnelFlow';

const getStepIndex = (step) => ({ name: 1, location: 2, details: 3, confirm: 4 }[step] || 0);
const TOTAL_STEPS = 4;

const VerticalIntentLanding = ({ cfg }) => {
  const brand = useBrand();
  useLandingTrack('name', cfg.variant);
  useFunnelFlow(cfg.flow); // session-wide intent (divorce/death) so the SERP + SUP can customize (like inmate)
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const V = cfg.variant;

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
  const [finalStatus] = useState('Searching our database...');
  const [finalProgress] = useState(60);

  const stepIndex = getStepIndex(step);
  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  useEffect(() => {
    let timer;
    if (step === 'searching-one') timer = setTimeout(() => { track('search_step', { step: 'location', search_type: 'name', variant: V }); setStep('location'); }, 5000);
    if (step === 'searching-two') timer = setTimeout(() => { track('search_step', { step: 'details', search_type: 'name', variant: V }); setStep('details'); }, 5000);
    return () => { if (timer) clearTimeout(timer); };
  }, [step, V]);

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
    e.preventDefault();
    setNameError('');
    if (!firstName.trim() || !lastName.trim()) { setNameError('Please enter a first and last name to search.'); track('validation_error', { reason: 'name_required', step: 'name' }); return; }
    track('search_step', { step: 'searching-one', search_type: 'name', variant: V });
    setStep('searching-one');
  };
  const continueFromLocation = () => {
    if (!state.trim()) { setLocationError('Please select a state before continuing.'); track('validation_error', { reason: 'state_required', step: 'location' }); return; }
    setLocationError('');
    track('search_step', { step: 'searching-two', search_type: 'name', variant: V });
    setStep('searching-two');
  };
  const continueFromDetails = () => { track('search_step', { step: 'confirm', search_type: 'name', variant: V }); setStep('confirm'); };
  const handleConfirm = () => {
    setAgreeError('');
    if (!agree) { setAgreeError('You must agree before continuing.'); track('validation_error', { reason: 'fcra_not_agreed', step: 'confirm' }); return; }
    track('search_step', { step: 'final-search', search_type: 'name', variant: V });
    track('fcra_agree', { search_type: 'name', variant: V });
    setStep('final-search');
    runSearch();
  };

  const id = (suffix) => `${cfg.idPrefix}-${suffix}`;

  return (
    <main className={s.page}>
      <header className={s.nav}>
        <a href="/" className={s.logo}>{brand.name}</a>
      </header>

      <div className={s.wrapper}>
        {step === 'name' && (
          <div className={s.hero}><h1 className={s.headline}>{cfg.headline}</h1></div>
        )}

        <div className={s.card}>
          {stepIndex >= 2 && stepIndex <= TOTAL_STEPS && (
            <div className={s.progress}>
              <p className={s.progressLabel}>Step {stepIndex} of {TOTAL_STEPS}</p>
              <div className={s.progressTrack} role="progressbar" aria-valuenow={stepIndex} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
                {[1, 2, 3, 4].map((n) => (<div key={n} className={`${s.progressSeg} ${n <= stepIndex ? s.progressSegOn : ''}`} />))}
              </div>
            </div>
          )}

          {step === 'name' && (
            <>
              <ul className={s.benefits}>
                {cfg.benefits.map(([ic, label]) => (
                  <li key={label} className={s.benefit}><Icon name={ic} className={s.benefitIcon} /><span>{label}</span></li>
                ))}
              </ul>
              <form className={s.form} onSubmit={startSearch}>
                <div className={s.nameRow}>
                  <div className={s.field}>
                    <label className={s.label} htmlFor={id('firstName')}>{cfg.firstLabel}</label>
                    <input id={id('firstName')} type="text" className={s.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={cfg.firstPlaceholder} required />
                  </div>
                  <div className={s.field}>
                    <label className={s.label} htmlFor={id('lastName')}>{cfg.lastLabel}</label>
                    <input id={id('lastName')} type="text" className={s.input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={cfg.lastPlaceholder} required />
                  </div>
                </div>
                {nameError && <p className={s.errorText}>{nameError}</p>}
                <button type="submit" className={s.cta}><Icon name="search" className={s.ctaIcon} /> Search Records</button>
              </form>
              <p className={s.social}><Icon name="seal" className={s.socialIcon} /> {cfg.socialProof}</p>
              <div className={s.valuePreview}>
                <p className={s.vpLabel}>{cfg.vpLabel || 'What you may find'}</p>
                <div className={s.vpGrid}>
                  {cfg.valuePreview.map(([ic, label]) => (
                    <span key={label} className={s.vpChip}><Icon name={ic} className={s.vpChipIcon} />{label}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === 'searching-one' && (
            <div className={s.searching}>
              <div className={s.spinner} />
              <h2 className={s.sectionTitle}>Searching</h2>
              <p className={s.helper}>{cfg.searchingOneHelper}</p>
              <ul className={s.searchList}>{cfg.searchingOneList.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}

          {step === 'location' && (
            <div className={s.form}>
              <h2 className={s.sectionTitle}>Which state?</h2>
              <p className={s.helper}>State helps us locate the records. Adding a city improves the results.</p>
              <div className={s.field}>
                <label className={s.label} htmlFor={id('state')}>State</label>
                <select id={id('state')} className={s.select} value={state} onChange={(e) => { setState(e.target.value); if (locationError) setLocationError(''); }} aria-invalid={!!locationError} style={locationError ? { borderColor: '#b91c1c' } : undefined}>
                  {US_STATES.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                </select>
                {locationError && <p className={s.errorText} role="alert">{locationError}</p>}
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor={id('city')}>City (optional)</label>
                <input id={id('city')} type="text" className={s.input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
              </div>
              <div className={s.actions}><button type="button" className={s.cta} onClick={continueFromLocation}>Continue</button></div>
            </div>
          )}

          {step === 'searching-two' && (
            <div className={s.searching}>
              <div className={s.spinner} />
              <h2 className={s.sectionTitle}>Searching</h2>
              <p className={s.helper}>Finding record matches for {firstName} {lastName}…</p>
              <ul className={s.searchList}>{cfg.searchingTwoList.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}

          {step === 'details' && (
            <div className={s.form}>
              <h2 className={s.sectionTitle}>{cfg.detailsTitle}</h2>
              <p className={s.helper}>A few more details help us surface the exact person.</p>
              {/* Data hook: reveal real records for the entered name (mirrors the inmate teaser on v3). */}
              {cfg.teaser === 'divorce' && lastName && state && (
                <DivorceTeaser firstName={firstName} lastName={lastName} state={state} />
              )}
              <div className={s.field}>
                <label className={s.label} htmlFor={id('age')}>Age (optional)</label>
                <input id={id('age')} type="text" className={s.input} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor={id('middle')}>Middle name (optional)</label>
                <input id={id('middle')} type="text" className={s.input} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name" />
              </div>
              <div className={s.actions}>
                <button type="button" className={s.cta} onClick={continueFromDetails}>Continue</button>
                <button type="button" className={s.buttonSecondary} onClick={continueFromDetails}>Skip</button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className={s.form}>
              <h2 className={s.sectionTitle}>{cfg.confirmTitle}</h2>
              <p className={s.helper}>Because this information can be misused, we ask every searcher to confirm they&apos;ll use it responsibly.</p>
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

          {step === 'final-search' && (
            <div className={s.searching}>
              <div className={s.spinner} />
              <h2 className={s.sectionTitle}>Searching</h2>
              <p className={s.helper}>{finalStatus}</p>
              <ul className={s.searchList}>{cfg.finalList.map((x) => <li key={x}>{x}</li>)}</ul>
              <p className={s.helper}>{finalProgress}% complete</p>
            </div>
          )}
        </div>
      </div>

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

export default VerticalIntentLanding;
