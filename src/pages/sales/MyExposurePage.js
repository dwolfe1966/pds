import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import { useBrand } from '../../services/brand';
import { useFunnelFlow } from '../../services/funnelFlow';
import { saveDeclaredIdentity } from '../../services/identityProfile';
import { updateMappedIdentity } from '../../services/memberEnrichment';

// Search-Yourself challenger (Flow C, 2026-07-29). Hypothesis: the strongest, most REPEATABLE emotion in this
// category isn't curiosity about others — it's anxiety about your OWN exposure. A self-search hook converts on a
// real, defensible worry AND sets up a subscription that has an ongoing job (monitor + claim + who's-searching)
// — the only one of our challengers that structurally attacks CHURN, not just conversion.
//
// Same PROVEN search hand-off as every other funnel: it navigate()s to /name/loader with the same params, so
// the search/contextKey core and BC billing are untouched (no price deviation). What's different is the
// EXPERIENCE: you're searching yourself, the loader narrates YOUR exposure, and checkout sells a standing
// service (see PaymentPage selfFunnel). No privacy claim (WSFY) and no takedown/suppression promise (stub).

const US_STATES = [
  ['', 'Select your state'], ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
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

const BLUE = '#0d5d2f';       // IDLookup brand green (was an off-brand navy #1f4e79)
const BLUE_SOFT = '#e7f3ec';  // green-soft to match
const AMBER = '#a9781f';
const AMBER_SOFT = '#f6edda';
const INK = '#14181d';
const MUTED = '#5b6672';
const LINE = '#dfe5ea';

export default function MyExposurePage() {
  const brand = useBrand();
  const navigate = useNavigate();
  useLandingTrack('name', 'self');
  useFunnelFlow('general'); // general people-search core; the SELF treatment rides on ?variant=self, not the flow

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [nameError, setNameError] = useState('');

  // Free-tier seam (owner 2026-08-15): the free tier needs PII to have value, so the anonymous self-door's
  // one job is to create a FREE account and carry the identity forward — NOT to run a paywall search. We
  // capture the identity into the mapped-identity store (what FreeExposureHero reads) and route to a FREE
  // signup that lands on /dashboard, where the exposure hero renders populated on first load. This also
  // makes account creation EXPLICIT (kills the old silent-account-creation smell).
  const proceedToFreeAccount = () => {
    const first = firstName.trim(), last = lastName.trim(), c = city.trim(), st = state.trim();
    gtmSetSearchInput({ firstName: first, lastName: last, middleName: '', city: c, state: st });
    // The data entered here IS the user's OWN identity (owner 2026-08-03). Stash for WSFY lead-linking…
    try {
      sessionStorage.setItem('selfIdentity', JSON.stringify({ firstName: first, lastName: last, city: c || undefined, state: st || undefined }));
    } catch { /* ignore */ }
    // …persist the durable declared identity…
    saveDeclaredIdentity({ firstName: first, lastName: last, city: c, state: st });
    // …and bridge it into the MAPPED-IDENTITY store (localStorage) that FreeExposureHero reads, so the
    // exposure score renders populated the moment they land on the dashboard after signup.
    updateMappedIdentity({ confirmed: true, name: [first, last].filter(Boolean).join(' '), city: c || undefined, state: st ? st.toUpperCase() : undefined });
    // Free account (no card): redirect=/dashboard lands on the exposure hero, NOT the paywall.
    navigate('/signup?redirect=%2Fdashboard&flow=exposure');
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setNameError('');
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('Enter your first and last name.');
      track('validation_error', { reason: 'name_required', variant: 'self' });
      return;
    }
    track('search_step', { step: 'free-account', search_type: 'name', variant: 'self' });
    proceedToFreeAccount();
  };

  const input = {
    width: '100%', border: `1.5px solid ${LINE}`, borderRadius: 10, padding: '13px 14px',
    fontSize: 16, color: INK, background: '#fbfdff', boxSizing: 'border-box',
  };
  const label = { fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED, fontWeight: 600, marginBottom: 5, display: 'block' };
  const metric = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED };

  return (
    <main style={{ background: '#f4f6f7', minHeight: '100vh', padding: 'clamp(20px,5vw,56px) 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
      <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>

        <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: BLUE, background: BLUE_SOFT, border: '1px solid #cfe0ef', padding: '5px 11px', borderRadius: 999 }}>
            Start with yourself
          </span>
          <h1 style={{ margin: 0, fontSize: 'clamp(28px,5.5vw,42px)', fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1.12, color: INK }}>
            See what strangers can find about&nbsp;you.
          </h1>
          <p style={{ margin: 0, color: MUTED, fontSize: 16, lineHeight: 1.5, maxWidth: '52ch' }}>
            Your address history, phone numbers, and public records are out there right now — searchable by anyone.
            Look yourself up, then decide what to do about it.
          </p>
        </header>

        <form onSubmit={onSubmit} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 'clamp(18px,4vw,26px)', boxShadow: '0 1px 2px rgba(20,24,29,.05),0 14px 40px rgba(20,24,29,.07)', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="ex-first">Your first name</label>
              <input id="ex-first" style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First" autoComplete="given-name" />
            </div>
            <div>
              <label style={label} htmlFor="ex-last">Your last name</label>
              <input id="ex-last" style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last" autoComplete="family-name" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={label} htmlFor="ex-state">Your state</label>
              <select id="ex-state" style={input} value={state} onChange={(e) => setState(e.target.value)}>
                {US_STATES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={label} htmlFor="ex-city">Your city <span style={{ textTransform: 'none', letterSpacing: 0, color: '#9aa4ad' }}>(optional)</span></label>
              <input id="ex-city" style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" autoComplete="address-level2" />
            </div>
          </div>
          {nameError && <p style={{ margin: 0, color: '#c0392b', fontSize: 13 }}>{nameError}</p>}

          <button type="submit" style={{ background: BLUE, color: '#fff', border: 0, borderRadius: 10, padding: '15px 22px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            See my exposure — free →
          </button>
          <p style={{ margin: 0, fontSize: 12, color: '#9aa4ad', textAlign: 'center' }}>
            Create your free {brand.name} account to see your Exposure Score and everything public about you. No card required.
          </p>
        </form>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 650, color: AMBER, background: AMBER_SOFT, border: '1px solid #e6d4a6', padding: '6px 12px', borderRadius: 999 }}>
            ★ See who's been searching for you
          </span>
          <span style={metric}>✓&nbsp;Cancel anytime — no surprise subscriptions</span>
        </div>

      </div>
    </main>
  );
}
