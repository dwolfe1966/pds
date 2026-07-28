import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import { useBrand } from '../../services/brand';
import { useFunnelFlow } from '../../services/funnelFlow';

// Honest People Search landing (2026-07-28). Same PROVEN search hand-off as the V3 funnel — it just
// navigate()s to /name/loader with the same params + flow, so the search/contextKey core and BC billing
// are untouched (no price deviation). What's "honest" here is the EXPERIENCE: real value prop, first-party
// data lead, private-search reassurance, FCRA consent kept in-flow, and zero fear-baiting / fake urgency.
// Spec: docs/marketing/honest-funnel-spec.md.

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
const GREEN_SOFT = '#e7f3ec';
const GOLD = '#a9781f';
const GOLD_SOFT = '#f6edda';
const INK = '#14181d';
const MUTED = '#5b6672';
const LINE = '#dfe5ea';

export default function PeopleSearchHonestPage() {
  const brand = useBrand();
  const navigate = useNavigate();
  useLandingTrack('name', 'honest');
  useFunnelFlow('inmate'); // session flow → results lead with the first-party booking teaser (our moat)

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [agree, setAgree] = useState(false);
  const [nameError, setNameError] = useState('');
  const [agreeError, setAgreeError] = useState('');

  // EXACT same hand-off as the V3 funnel — do not change (search contextKey is our documented landmine).
  const runSearch = () => {
    gtmSetSearchInput({ firstName: firstName.trim(), lastName: lastName.trim(), middleName: '', city: city.trim(), state: state.trim() });
    // Honest-funnel marker — a clean side-channel read downstream (loader, checkout) for the honest
    // experience, WITHOUT threading params through the search/contextKey core.
    try { sessionStorage.setItem('honestFunnel', '1'); } catch { /* ignore */ }
    try { sessionStorage.removeItem('nameSearchResults'); } catch { /* ignore */ }
    const params = new URLSearchParams();
    params.set('firstName', firstName.trim());
    params.set('lastName', lastName.trim());
    if (state.trim()) params.set('state', state.trim());
    if (city.trim()) params.set('city', city.trim());
    params.set('flow', 'inmate');
    params.set('honest', '1'); // DISPLAY-ONLY flag → honest loader copy; the search ignores it entirely
    navigate(`/name/loader?${params.toString()}`);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setNameError(''); setAgreeError('');
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('Enter a first and last name to search.');
      track('validation_error', { reason: 'name_required', variant: 'honest' });
      return;
    }
    if (!agree) {
      setAgreeError('Please agree before continuing.');
      track('validation_error', { reason: 'fcra_not_agreed', variant: 'honest' });
      return;
    }
    track('search_step', { step: 'final-search', search_type: 'name', variant: 'honest' });
    track('fcra_agree', { search_type: 'name', variant: 'honest' });
    runSearch();
  };

  const input = {
    width: '100%', border: `1.5px solid ${LINE}`, borderRadius: 10, padding: '13px 14px',
    fontSize: 16, color: INK, background: '#fbfdfc', boxSizing: 'border-box',
  };
  const label = { fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED, fontWeight: 600, marginBottom: 5, display: 'block' };
  const metric = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED };

  return (
    <main style={{ background: '#f4f6f7', minHeight: '100vh', padding: 'clamp(20px,5vw,56px) 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 'clamp(28px,5.5vw,42px)', fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1.12, color: INK }}>
            Search anyone — with records you can actually trust.
          </h1>
          <p style={{ margin: 0, color: MUTED, fontSize: 16, lineHeight: 1.5, maxWidth: '52ch' }}>
            Addresses, contacts, and public records — sourced, current, and shown to you plainly.
            No fake alarms, no surprise subscriptions.
          </p>
        </header>

        <form onSubmit={onSubmit} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 'clamp(18px,4vw,26px)', boxShadow: '0 1px 2px rgba(20,24,29,.05),0 14px 40px rgba(20,24,29,.07)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="hs-first">First name</label>
              <input id="hs-first" style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" autoComplete="given-name" />
            </div>
            <div>
              <label style={label} htmlFor="hs-last">Last name</label>
              <input id="hs-last" style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" autoComplete="family-name" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="hs-state">State</label>
              <select id="hs-state" style={input} value={state} onChange={(e) => setState(e.target.value)}>
                {US_STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={label} htmlFor="hs-city">City <span style={{ textTransform: 'none', letterSpacing: 0, color: '#9aa4ad' }}>(optional)</span></label>
              <input id="hs-city" style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Houston" autoComplete="address-level2" />
            </div>
          </div>
          {nameError && <p style={{ margin: 0, color: '#c0392b', fontSize: 13 }}>{nameError}</p>}

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12.5, color: MUTED, lineHeight: 1.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 2, accentColor: GREEN, flex: 'none' }} />
            <span>I will not use information from {brand.name} for employment, tenant screening, credit, or any purpose restricted by the Fair Credit Reporting Act (FCRA).</span>
          </label>
          {agreeError && <p style={{ margin: 0, color: '#c0392b', fontSize: 13 }}>{agreeError}</p>}

          <button type="submit" style={{ background: GREEN, color: '#fff', border: 0, borderRadius: 10, padding: '15px 22px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            Search records →
          </button>
        </form>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 650, color: GOLD, background: GOLD_SOFT, border: '1px solid #e6d4a6', padding: '6px 12px', borderRadius: 999 }}>
            ★ First-party booking records — all 50 states
          </span>
          <span style={metric}><b style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>214M</b>&nbsp;profiles</span>
          <span style={metric}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Your search is private — the person is never notified
          </span>
        </div>

      </div>
    </main>
  );
}
