import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import { useBrand } from '../../services/brand';
import { useFunnelFlow } from '../../services/funnelFlow';

// Proof-First challenger (Flow B, 2026-07-29). Hypothesis: people don't distrust us because we're dishonest —
// they distrust us because everyone in this category PROMISES results then paywalls a blur. If we show one
// REAL, verifiable finding in the clear BEFORE the paywall, the paywall stops feeling like a gamble. This is a
// MECHANIC (front-load real data), not a tone. It weaponizes our first-party records (booking / life-events)
// that competitors can't match.
//
// Same PROVEN search hand-off (navigate() to /name/loader, identical params → search core + BC billing
// untouched, no price deviation). What's different rides on ?variant=proof: the SRP reveals ONE real signal
// fact in the clear (never a fabricated card), and if there's no real signal we DEGRADE honestly (never invent
// one — that would break the entire premise). Checkout framing: "you saw one verified finding — unlock the rest."

const US_STATES = [
  ['', 'Select a state'], ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'],
  ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'], ['MO', 'Missouri'],
  ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'], ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'],
  ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'], ['VA', 'Virginia'],
  ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
];

const GREEN = '#0d5d2f';
const GOLD = '#a9781f';
const GOLD_SOFT = '#f6edda';
const INK = '#14181d';
const MUTED = '#5b6672';
const LINE = '#dfe5ea';

export default function ProofCheckPage() {
  const brand = useBrand();
  const navigate = useNavigate();
  useLandingTrack('name', 'proof');
  useFunnelFlow('general'); // general people-search core; the PROOF treatment rides on ?variant=proof

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [agree, setAgree] = useState(false);
  const [nameError, setNameError] = useState('');
  const [agreeError, setAgreeError] = useState('');

  // EXACT same hand-off as the other funnels — do not change (search contextKey is our documented landmine).
  const runSearch = () => {
    gtmSetSearchInput({ firstName: firstName.trim(), lastName: lastName.trim(), middleName: '', city: city.trim(), state: state.trim() });
    try { sessionStorage.removeItem('nameSearchResults'); } catch { /* ignore */ }
    const params = new URLSearchParams();
    params.set('firstName', firstName.trim());
    params.set('lastName', lastName.trim());
    if (state.trim()) params.set('state', state.trim());
    if (city.trim()) params.set('city', city.trim());
    params.set('flow', 'general');    // general core — teaser resolves the strongest REAL signal to reveal
    params.set('variant', 'proof');   // DISPLAY-ONLY: reveal-one-fact SRP + "unlock the rest" checkout framing
    navigate(`/name/loader?${params.toString()}`);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setNameError(''); setAgreeError('');
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('Enter a first and last name to search.');
      track('validation_error', { reason: 'name_required', variant: 'proof' });
      return;
    }
    if (!agree) {
      setAgreeError('Please agree before continuing.');
      track('validation_error', { reason: 'fcra_not_agreed', variant: 'proof' });
      return;
    }
    track('search_step', { step: 'final-search', search_type: 'name', variant: 'proof' });
    track('fcra_agree', { search_type: 'name', variant: 'proof' });
    runSearch();
  };

  const input = {
    width: '100%', border: `1.5px solid ${LINE}`, borderRadius: 10, padding: '13px 14px',
    fontSize: 16, color: INK, background: '#fbfdfc', boxSizing: 'border-box',
  };
  const label = { fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED, fontWeight: 600, marginBottom: 5, display: 'block' };
  const step = { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: '#3f4a54', lineHeight: 1.5 };
  const stepNum = { flex: 'none', width: 22, height: 22, borderRadius: 999, background: GREEN, color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <main style={{ background: '#f4f6f7', minHeight: '100vh', padding: 'clamp(20px,5vw,56px) 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(28px,5.5vw,42px)', fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1.12, color: INK }}>
            We'll show you a real finding — before you pay a cent.
          </h1>
          <p style={{ margin: 0, color: MUTED, fontSize: 16, lineHeight: 1.5, maxWidth: '52ch' }}>
            Everyone else promises results and then hides them behind a blur. We do it backwards: search, and
            we'll show you one verified record in the clear — something you can check — then decide.
          </p>
        </header>

        <form onSubmit={onSubmit} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 'clamp(18px,4vw,26px)', boxShadow: '0 1px 2px rgba(20,24,29,.05),0 14px 40px rgba(20,24,29,.07)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="pf-first">First name</label>
              <input id="pf-first" style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" autoComplete="given-name" />
            </div>
            <div>
              <label style={label} htmlFor="pf-last">Last name</label>
              <input id="pf-last" style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" autoComplete="family-name" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="pf-state">State</label>
              <select id="pf-state" style={input} value={state} onChange={(e) => setState(e.target.value)}>
                {US_STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={label} htmlFor="pf-city">City <span style={{ textTransform: 'none', letterSpacing: 0, color: '#9aa4ad' }}>(optional)</span></label>
              <input id="pf-city" style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Houston" autoComplete="address-level2" />
            </div>
          </div>
          {nameError && <p style={{ margin: 0, color: '#c0392b', fontSize: 13 }}>{nameError}</p>}

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: MUTED, lineHeight: 1.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2, accentColor: GREEN, flex: 'none' }} />
            <span>I will not use information from {brand.name} for employment, tenant screening, credit, or any purpose restricted by the Fair Credit Reporting Act (FCRA).</span>
          </label>
          {agreeError && <p style={{ margin: 0, color: '#c0392b', fontSize: 13 }}>{agreeError}</p>}

          <button type="submit" style={{ background: GREEN, color: '#fff', border: 0, borderRadius: 10, padding: '15px 22px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            Show me proof →
          </button>
        </form>

        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 'clamp(16px,4vw,22px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED, fontWeight: 700 }}>How proof-first works</p>
          <div style={step}><span style={stepNum}>1</span><span>Search a name. We check our own records + public sources.</span></div>
          <div style={step}><span style={stepNum}>2</span><span><strong>We show you one real, checkable finding for free</strong> — a booking county &amp; year, or a records match — not a blurred card.</span></div>
          <div style={step}><span style={stepNum}>3</span><span>Like what you see? Unlock the rest. Found nothing real? We tell you straight — no invented matches.</span></div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 650, color: GOLD, background: GOLD_SOFT, border: '1px solid #e6d4a6', padding: '6px 12px', borderRadius: 999 }}>
            ★ Proof before payment — nothing fabricated
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED }}>✓&nbsp;Cancel anytime</span>
        </div>

      </div>
    </main>
  );
}
