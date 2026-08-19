import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { track } from '../../services/trackingService';
import { useBrand } from '../../services/brand';
import { useFunnelFlow } from '../../services/funnelFlow';
import { saveDeclaredIdentity } from '../../services/identityProfile';
import { updateMappedIdentity } from '../../services/memberEnrichment';
import { useSignup } from '../../hooks/useSignup';
import SignalTeaser from '../../components/SignalTeaser';

// Free-tier "Check my exposure" front door — VALUE-FIRST (owner 2026-08-19). Two steps:
//   1. Enter your name → 2. SEE your exposure teaser (what's public + any records), NO account →
//   a light EMAIL-ONLY step ("see your full Exposure Score & who's searching") creates the free account
//   (auto-password, no card) and lands on /dashboard where the exposure hero renders populated + breaches.
// The old flow dumped people on the create-account page BEFORE showing any value — that was the friction.

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

const BLUE = '#0d5d2f';
const BLUE_SOFT = '#e7f3ec';
const AMBER = '#a9781f';
const AMBER_SOFT = '#f6edda';
const INK = '#14181d';
const MUTED = '#5b6672';
const LINE = '#dfe5ea';

const PAGE = { background: '#f4f6f7', minHeight: '100vh', padding: 'clamp(20px,5vw,56px) 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' };
const CARD = { background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 'clamp(18px,4vw,26px)', boxShadow: '0 1px 2px rgba(20,24,29,.05),0 14px 40px rgba(20,24,29,.07)' };

// What the full exposure check covers — shown as a teaser (capabilities + the breach hook that the email unlocks).
const EXPOSED = [
  ['📍', 'Address history', 'Current & past addresses on record'],
  ['📞', 'Phone numbers', 'Landline & mobile numbers'],
  ['👪', 'Relatives & associates', 'Family and known associates'],
  ['🚔', 'Criminal & court records', 'Arrests, charges & court cases'],
  ['🔓', 'Data breaches', 'Where your email & passwords have leaked'],
];

export default function MyExposurePage() {
  const brand = useBrand();
  const navigate = useNavigate();
  useLandingTrack('name', 'self');
  useFunnelFlow('general');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [nameError, setNameError] = useState('');

  const [step, setStep] = useState('form'); // 'form' → 'teaser'
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState('');
  // NOTE: useSignup seeds redirectTo='/dashboard' by default, so gate navigation on `success` — otherwise
  // this fires on mount and bounces the anonymous visitor to /dashboard → /login.
  const { submit: signupSubmit, loading: creating, error: signupError, success, redirectTo } = useSignup();
  useEffect(() => { if (success && redirectTo) navigate(redirectTo); }, [success, redirectTo, navigate]);

  const input = { width: '100%', border: `1.5px solid ${LINE}`, borderRadius: 10, padding: '13px 14px', fontSize: 16, color: INK, background: '#fbfdff', boxSizing: 'border-box' };
  const label = { fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: MUTED, fontWeight: 600, marginBottom: 5, display: 'block' };
  const metric = { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED };
  const cta = { background: BLUE, color: '#fff', border: 0, borderRadius: 10, padding: '15px 22px', fontSize: 16, fontWeight: 700, cursor: 'pointer' };

  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

  // Capture the person's OWN identity (owner 2026-08-03) + bridge it into the mapped-identity store the
  // dashboard exposure hero reads, so it renders populated the moment they land after the free account.
  const captureIdentity = () => {
    const first = firstName.trim(), last = lastName.trim(), c = city.trim(), st = state.trim();
    gtmSetSearchInput({ firstName: first, lastName: last, middleName: '', city: c, state: st });
    try { sessionStorage.setItem('selfIdentity', JSON.stringify({ firstName: first, lastName: last, city: c || undefined, state: st || undefined })); } catch { /* ignore */ }
    saveDeclaredIdentity({ firstName: first, lastName: last, city: c, state: st });
    updateMappedIdentity({ confirmed: true, name: [first, last].filter(Boolean).join(' '), city: c || undefined, state: st ? st.toUpperCase() : undefined });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    setNameError('');
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('Enter your first and last name.');
      track('validation_error', { reason: 'name_required', variant: 'self' });
      return;
    }
    captureIdentity();
    track('search_step', { step: 'self-teaser', search_type: 'name', variant: 'self' });
    setStep('teaser');
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  // Auto-generated password — the free account is email-only (no card), same as email-on-payment.
  const genPw = () => `Ix${Math.random().toString(36).slice(2, 11)}${Math.random().toString(36).slice(2, 5).toUpperCase()}9!`;

  const createFreeAccount = async (e) => {
    e.preventDefault();
    setEmailErr('');
    const em = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setEmailErr('Enter a valid email address.'); return; }
    track('search_step', { step: 'free-account', search_type: 'name', variant: 'self' });
    // Free account: email only, auto-password, no card. Lands on /dashboard (exposure hero + breach + WSFY).
    await signupSubmit({ email: em, password: genPw(), optin: true, redirectParam: '/dashboard' });
  };

  // ── STEP 2: exposure teaser (value first — no account) + email-only unlock ──
  if (step === 'teaser') {
    return (
      <main style={PAGE}>
        <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: BLUE, background: BLUE_SOFT, border: '1px solid #cfe0ef', padding: '5px 11px', borderRadius: 999 }}>Your exposure</span>
            <h1 style={{ margin: 0, fontSize: 'clamp(24px,5vw,36px)', fontWeight: 800, letterSpacing: '-.025em', lineHeight: 1.14, color: INK }}>
              Here&apos;s what&apos;s public about {fullName || 'you'}.
            </h1>
            <p style={{ margin: 0, color: MUTED, fontSize: 15.5, lineHeight: 1.5 }}>
              Your personal information is out there right now — searchable by anyone. Here&apos;s what we found.
            </p>
          </header>

          <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Real first-party records for this name (safe-by-default: renders nothing if none). */}
            <SignalTeaser subject={{ firstName: firstName.trim(), lastName: lastName.trim(), state, city: city.trim() }} flow="publicRecords" strict stage="pre-signup" accent={BLUE} />

            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: MUTED, margin: '0 0 8px' }}>What&apos;s exposed about you</div>
              <div style={{ border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
                {EXPOSED.map(([icon, l, sub], i) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i ? `1px solid ${LINE}` : 'none' }}>
                    <span style={{ fontSize: 17, flex: '0 0 auto' }} aria-hidden="true">{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: INK }}>{l}</div>
                      <div style={{ fontSize: 12, color: MUTED }}>{sub}</div>
                    </div>
                    <span style={{ fontSize: 12.5, color: MUTED, flex: '0 0 auto' }} aria-hidden="true">🔒</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Email-only unlock → free account → dashboard (full Exposure Score + breaches + who's-searching). */}
          <form onSubmit={createFreeAccount} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 12, background: BLUE_SOFT, border: '1px solid #cfe0d6' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: INK }}>See your full Exposure Score &amp; who&apos;s searching for you</div>
            <p style={{ margin: 0, fontSize: 13.5, color: MUTED, lineHeight: 1.5 }}>Enter your email to unlock your complete report — including data breaches on your email and the people who&apos;ve looked you up.</p>
            <input type="email" inputMode="email" autoComplete="email" autoFocus style={input} placeholder="you@email.com" value={email} onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(''); }} />
            {(emailErr || signupError) && <p style={{ margin: 0, color: '#c0392b', fontSize: 13 }}>{emailErr || signupError}</p>}
            <button type="submit" disabled={creating} style={{ ...cta, opacity: creating ? 0.7 : 1 }}>{creating ? 'Checking…' : 'Show my full exposure →'}</button>
            <p style={{ margin: 0, fontSize: 12, color: '#9aa4ad', textAlign: 'center' }}>Free · no card required · we&apos;ll email you your report.</p>
          </form>
        </div>
      </main>
    );
  }

  // ── STEP 1: the name form ──
  return (
    <main style={PAGE}>
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
            Look yourself up and see exactly what&apos;s exposed.
          </p>
        </header>

        <form onSubmit={onSubmit} style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: 14 }}>
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

          <button type="submit" style={cta}>See what&apos;s public about me →</button>
          <p style={{ margin: 0, fontSize: 12, color: '#9aa4ad', textAlign: 'center' }}>
            Free · no card required. See what&apos;s exposed first, then get your full Exposure Score.
          </p>
        </form>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 650, color: AMBER, background: AMBER_SOFT, border: '1px solid #e6d4a6', padding: '6px 12px', borderRadius: 999 }}>
            ★ See who&apos;s been searching for you
          </span>
          <span style={metric}>✓&nbsp;Cancel anytime — no surprise subscriptions</span>
        </div>

      </div>
    </main>
  );
}
