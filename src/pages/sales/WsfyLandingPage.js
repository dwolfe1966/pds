import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { track } from '../../services/trackingService';
import { useSignup } from '../../hooks/useSignup';
import api from '../../api';
import { generateKba, gradeKba } from '../../utils/kba';
import { saveMemberProfile } from '../../services/memberEnrichment';
import DlScanVerify from '../../components/DlScanVerify';
import US_STATES from './usStates';
import ColorLandingFooter from './ColorLandingFooter';
import { ReviewStars, TrustBadges, Testimonials, StatStrip } from './BvSocialProof';

/**
 * Visitor WSFY funnel — IDENTITY-FIRST, fully inline (owner 2026-07-16). All identity-CONFIRMATION
 * data is captured in the wizard steps (name + city/state, age, email + phone), then we match the
 * visitor's own record, they confirm ("that's me") + one lightweight KBA — ALL native to this flow,
 * no dashboard module. On confirm we silently create the account (auto-password + login-link email),
 * complete the profile from the matched record (mapped_identity), and push into PAYMENT to reveal
 * who's searching. Groups PII by purpose: About you → Pinpoint you → Confirm it's you.
 */
const P = { green: '#0d5d2f', greenDark: '#0a4a25', ink: '#0f2533', mut: '#5b7484', line: '#d3e3ec', bg: '#eef6fb' };
const TOTAL_STEPS = 3;
const getStepIndex = (s) => ({ about: 1, pinpoint: 2, contact: 3 }[s] || 0);

// The "carrot" — kept dangling through the whole mapping flow. WSFY leads; other identity value props
// rotate in (control exposure, removal). Extend this list to add more props over time (owner 2026-07-16).
const VALUE_PROPS = [
  { icon: '👀', text: 'See who’s searching for you' },
  { icon: '🛡️', text: 'Control what strangers can find about you' },
  { icon: '🔒', text: 'Remove yourself from public searches' },
];

const genPassword = () => {
  const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `Id!${rand.slice(0, 14)}A9`;
};

function narrowMatches(list, city, age) {
  let out = Array.isArray(list) ? list : [];
  if (city && city.trim()) {
    const c = city.trim().toLowerCase();
    const byCity = out.filter((m) => `${m.location || ''} ${m.city || ''}`.toLowerCase().includes(c));
    if (byCity.length) out = byCity;
  }
  if (age && String(age).trim()) {
    const a = parseInt(String(age), 10);
    if (!Number.isNaN(a)) {
      const byAge = out.filter((m) => {
        const ma = parseInt((String(m.age || m.ageRange || '').match(/\d+/) || [])[0] || '', 10);
        return !Number.isNaN(ma) && Math.abs(ma - a) <= 3;
      });
      if (byAge.length) out = byAge;
    }
  }
  return out;
}

const WsfyLandingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const q = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const { submit: signupSubmit } = useSignup();

  const [firstName, setFirstName] = useState(q.get('fn') || q.get('firstName') || '');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState(q.get('ln') || q.get('lastName') || '');
  const [city, setCity] = useState(q.get('city') || '');
  const [state, setState] = useState(q.get('state') || '');
  const [zip, setZip] = useState(q.get('zip') || '');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState('about');
  const [err, setErr] = useState('');
  const [vpIdx, setVpIdx] = useState(0); // rotating value-prop "carrot"

  const [matches, setMatches] = useState([]);
  const [selfPerson, setSelfPerson] = useState(null);
  const [kbaQuestions, setKbaQuestions] = useState([]);
  const [kbaAnswers, setKbaAnswers] = useState({});
  const [kbaAttempts, setKbaAttempts] = useState(0);
  const [showDlScan, setShowDlScan] = useState(false);
  const KBA_MAX = 5;
  const kbaLocked = kbaAttempts >= KBA_MAX;
  const stepIndex = getStepIndex(step);

  useEffect(() => { window.scrollTo(0, 0); }, [step]);
  useEffect(() => { track('wsfy_landing_view', {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setVpIdx((i) => (i + 1) % VALUE_PROPS.length), 3200); return () => clearInterval(t); }, []);

  const continueAbout = (e) => {
    e.preventDefault(); setErr('');
    if (!firstName.trim() || !lastName.trim()) { setErr('Please enter your first and last name.'); return; }
    if (!state.trim()) { setErr('Please select your state.'); return; }
    if (!city.trim()) { setErr('Please enter your city — it pins down the right record.'); return; }
    if (zip.trim().length !== 5) { setErr('Please enter your current 5-digit ZIP code.'); return; }
    track('wsfy_step', { step: 'pinpoint' }); setStep('pinpoint');
  };
  const continuePinpoint = () => {
    setErr('');
    if (!age.trim()) { setErr('Please enter your age so we match the right person.'); return; }
    if (!middleName.trim()) { setErr('Please enter your middle name — it helps confirm the right record.'); return; }
    track('wsfy_step', { step: 'contact' }); setStep('contact');
  };

  // Contact → run the match on the captured identity. EXACT-FIRST: a matching phone or email resolves
  // the exact person; fall back to name + location + age (owner 2026-07-16).
  const findMyRecord = async () => {
    setErr('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('Please enter a valid email.'); return; }
    track('wsfy_step', { step: 'searching' }); setStep('searching');
    const run = async (params) => { try { const r = await api.searchPeople(params); return r?.data || []; } catch { return null; } };
    try {
      let results = null, exact = false;
      // EXACT-FIRST order (owner 2026-07-16): email → phone → name/location/age.
      {
        const d = await run({ email: email.trim(), type: 'email', source: 'wsfy-landing' });
        if (d && d.length) { results = d; exact = true; track('wsfy_match_via', { via: 'email' }); }
      }
      if (!results) {
        const phoneDigits = phone.replace(/\D/g, '');
        if (phoneDigits.length >= 10) {
          const d = await run({ phone: phoneDigits, type: 'phone', source: 'wsfy-landing' });
          if (d && d.length) { results = d; exact = true; track('wsfy_match_via', { via: 'phone' }); }
        }
      }
      if (!results) {
        const d = await run({ firstName: firstName.trim(), lastName: lastName.trim(), middleName: middleName.trim() || undefined,
          state: state.trim() || undefined, city: city.trim() || undefined, zip: zip.trim() || undefined, age: age.trim() || undefined, type: 'name', source: 'wsfy-landing' });
        if (d === null) { setErr("We couldn't run the search right now. Please try again in a moment."); setStep('contact'); return; }
        results = d; track('wsfy_match_via', { via: 'name' });
      }
      // Exact (phone/email) hits are already the right person — don't narrow them away; name hits do.
      const narrowed = exact ? results : narrowMatches(results, city, age);
      if (!narrowed.length) { setErr("We couldn't find a record matching those details. Check your spelling or try again."); setStep('contact'); return; }
      setMatches(narrowed.slice(0, 6));
      track('wsfy_matches', { count: narrowed.length, exact });
      setStep('choose');
    } catch {
      setErr("We couldn't run the search right now. Please try again in a moment.");
      setStep('contact');
    }
  };

  // Pick "this is me" → go to the verify step (a KBA question when we can build one, always the DL option).
  const chooseMatch = (m) => {
    const sp = { name: m?.fullName, city: m?.city || city || undefined, state: m?.state || state || undefined, age: m?.age || m?.ageRange || age || undefined };
    setSelfPerson(sp);
    setKbaQuestions(generateKba(null, sp, 1));
    setKbaAnswers({}); setKbaAttempts(0); setErr(''); setShowDlScan(false);
    track('wsfy_record_selected', {});
    setStep('verify');
  };

  const submitKba = () => {
    if (kbaLocked) return;
    if (kbaQuestions.length) {
      if (kbaQuestions.some((qq) => !kbaAnswers[qq.id])) { setErr('Please answer to continue.'); return; }
      if (!gradeKba(kbaQuestions, kbaAnswers)) {
        const next = kbaAttempts + 1; setKbaAttempts(next);
        setErr(next >= KBA_MAX ? 'Too many incorrect attempts. Verify with your license below, or contact support.' : "That doesn't match your record. Please try again.");
        return;
      }
    }
    confirmIdentity(selfPerson, 'kba');
  };

  // Confirmed (via KBA or DL scan) → silently create the account, complete the profile, → payment.
  const confirmIdentity = async (sp, verified) => {
    setErr(''); setStep('creating');
    const ok = await signupSubmit({
      email: email.trim(), password: genPassword(),
      extraPayload: { firstName: firstName.trim(), lastName: lastName.trim(), fullName: [firstName, middleName, lastName].filter(Boolean).join(' ').trim(), phone: phone.trim() || undefined, intent: 'wsfy' },
    });
    if (!ok) { setErr('That email may already be in use — try logging in instead.'); setStep('contact'); return; }
    try { saveMemberProfile({ selfPerson: sp, city: sp.city, state: sp.state, verified: verified || 'kba', source: 'wsfy-landing' }); } catch { /* mirror is best-effort */ }
    track('wsfy_identity_confirmed', { verified: verified || 'kba' });
    navigate('/payment?reason=wsfy');
  };

  const input = { width: '100%', boxSizing: 'border-box', padding: '0.85rem 0.95rem', fontSize: '1rem', border: `1.5px solid ${P.line}`, borderRadius: 10, outline: 'none', background: '#fff', color: P.ink };
  const cta = { width: '100%', minHeight: 58, marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.06rem', fontWeight: 800, color: '#fff', background: P.green, border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 8px 20px rgba(13,93,47,0.3)' };
  const card = { background: '#fff', border: `1px solid ${P.line}`, borderRadius: 16, padding: '1.6rem 1.5rem', boxShadow: '0 10px 30px rgba(5,90,134,0.10)' };
  const label = { display: 'block', fontSize: '0.82rem', fontWeight: 600, color: P.greenDark, margin: '0 0 0.3rem' };

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 42%)' }}>
      {/* Header — brand + "already a member?" jump straight to the member WSFY page. */}
      <header style={{ borderBottom: `1px solid ${P.line}`, background: 'rgba(255,255,255,0.85)' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0.7rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontWeight: 800, color: P.green, fontSize: '1.05rem' }}>IDLookup</span>
          <Link to="/who-is-searching" style={{ color: P.green, fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Already a member? See who’s searching →
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.75rem 1rem 2.5rem' }}>
        {step === 'about' && (
          <div style={{ textAlign: 'center', marginBottom: '1.4rem' }}>
            <h1 style={{ margin: 0, fontSize: '2.1rem', lineHeight: 1.12, fontWeight: 800, letterSpacing: '-0.02em', color: P.ink }}>See Who&apos;s Searching For You</h1>
            <p style={{ margin: '0.6rem 0 0', fontSize: '1rem', color: P.mut, lineHeight: 1.5 }}>Confirm your identity to see who&apos;s looking you up — and control what they can find.</p>
            <div style={{ marginTop: '0.6rem' }}><ReviewStars /></div>
          </div>
        )}

        <div style={card}>
          {/* Dangling "carrot" — the payoff kept visible through every mapping step. */}
          {['about', 'pinpoint', 'contact', 'choose', 'verify'].includes(step) && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '0.6rem 0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden="true" style={{ fontSize: 18 }}>{(step === 'choose' || step === 'verify') ? '🎯' : VALUE_PROPS[vpIdx].icon}</span>
              <span style={{ fontSize: '0.86rem', color: '#14532d', fontWeight: 700, lineHeight: 1.4 }}>
                {(step === 'choose' || step === 'verify') ? 'Almost there — confirm to reveal who’s been searching for you.' : VALUE_PROPS[vpIdx].text}
              </span>
            </div>
          )}
          {stepIndex >= 1 && stepIndex <= TOTAL_STEPS && (
            <div style={{ marginBottom: '1.3rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: P.mut }}>Step {stepIndex} of {TOTAL_STEPS}</p>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[1, 2, 3].map((n) => <div key={n} style={{ flex: 1, height: 6, borderRadius: 999, background: n <= stepIndex ? P.green : '#dbe9f2' }} />)}
              </div>
            </div>
          )}

          {step === 'about' && (
            <form onSubmit={continueAbout} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Who are you?</h2>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}><label style={label} htmlFor="wsfy-fn">First name</label><input id="wsfy-fn" style={input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
                <div style={{ flex: 1 }}><label style={label} htmlFor="wsfy-ln">Last name</label><input id="wsfy-ln" style={input} value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}><label style={label} htmlFor="wsfy-city">City</label><input id="wsfy-city" style={input} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Your city" required /></div>
                <div style={{ flex: 1 }}><label style={label} htmlFor="wsfy-state">State</label>
                  <select id="wsfy-state" style={input} value={state} onChange={(e) => setState(e.target.value)}>{US_STATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                </div>
                <div style={{ width: 120 }}><label style={label} htmlFor="wsfy-zip">Current ZIP</label><input id="wsfy-zip" style={input} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder="ZIP" inputMode="numeric" required /></div>
              </div>
              {err && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: 0 }}>{err}</p>}
              <button type="submit" style={cta}>Continue</button>
            </form>
          )}

          {step === 'pinpoint' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Pinpoint your record</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut }}>Age and middle name make sure we match the right {firstName || 'person'}.</p>
              <label style={label} htmlFor="wsfy-age">Your age</label>
              <input id="wsfy-age" style={{ ...input, marginBottom: '0.75rem' }} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" inputMode="numeric" />
              <label style={label} htmlFor="wsfy-mid">Middle name</label>
              <input id="wsfy-mid" style={{ ...input, marginBottom: '1rem' }} value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Middle name" required />
              {err && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{err}</p>}
              <button type="button" style={cta} onClick={continuePinpoint}>Continue</button>
            </div>
          )}

          {step === 'contact' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Confirm it&apos;s you</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut }}>We use your email and phone to confirm your identity and secure your account.</p>
              <label style={label} htmlFor="wsfy-email">Email</label>
              <input id="wsfy-email" type="email" style={{ ...input, marginBottom: '0.75rem', borderColor: err ? '#b91c1c' : P.line }} value={email} onChange={(e) => { setEmail(e.target.value); if (err) setErr(''); }} placeholder="you@example.com" required />
              <label style={label} htmlFor="wsfy-phone">Mobile phone</label>
              <input id="wsfy-phone" type="tel" style={{ ...input, marginBottom: '1rem' }} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
              {err && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem' }}>{err}</p>}
              <button type="button" style={cta} onClick={findMyRecord}>Find my record →</button>
              <p style={{ margin: '0.9rem 0 0', fontSize: '0.78rem', color: P.mut, textAlign: 'center', lineHeight: 1.5 }}>We create your account automatically and email you a secure login link — no password to remember.</p>
            </div>
          )}

          {(step === 'searching' || step === 'creating') && <Spinner title={step === 'searching' ? 'Finding your record…' : 'Confirming your identity…'} P={P} />}

          {step === 'choose' && (
            <div>
              <h2 style={{ margin: '0 0 0.2rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>We found your record 🎉</h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: P.mut }}>Select the one that&apos;s you — this is your identity, and you&apos;ll control what&apos;s public about it.</p>
              <div style={{ display: 'grid', gap: 10 }}>
                {matches.map((m, i) => (
                  <button key={m.extId || i} type="button" onClick={() => chooseMatch(m)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', background: '#fff', border: `1.5px solid ${P.line}`, borderRadius: 12, padding: '0.9rem 1rem', cursor: 'pointer' }}>
                    <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#f0fdf4', color: P.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{(m.fullName || '?')[0]}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 800, color: P.ink }}>{m.fullName}{(m.age || m.ageRange) ? `, ${m.age || m.ageRange}` : ''}</span>
                      <span style={{ display: 'block', fontSize: 13, color: P.mut, marginTop: 2 }}>📍 {m.location || [m.city, m.state].filter(Boolean).join(', ')}</span>
                    </span>
                    <span style={{ color: P.green, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>This is me →</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setStep('contact')} style={{ marginTop: 14, background: 'none', border: 'none', color: P.green, fontSize: 13, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}>None of these are me</button>
            </div>
          )}

          {step === 'verify' && (showDlScan ? (
            <div>
              <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>🛡️ Verify with your license</h2>
              <DlScanVerify recordName={selfPerson && selfPerson.name} onVerified={() => confirmIdentity(selfPerson, 'id')} onCancel={() => setShowDlScan(false)} />
              <button type="button" onClick={() => setShowDlScan(false)} style={{ marginTop: 12, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>← Answer a question instead</button>
            </div>
          ) : (
            <div>
              <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.25rem', fontWeight: 800, color: P.ink }}>Confirm it&apos;s really you</h2>
              {selfPerson && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '4px 12px', marginBottom: 12, fontSize: 13, fontWeight: 700, color: '#14532d' }}>✓ Claiming: {selfPerson.name}</div>
              )}
              <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: P.mut }}>
                {kbaQuestions.length ? 'One quick question from your record — this keeps someone else from claiming your identity.' : 'Confirm this record is yours to unlock who’s been searching for you.'}
              </p>
              {kbaQuestions.map((qq) => (
                <div key={qq.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, color: P.ink, fontSize: 14, marginBottom: 8 }}>{qq.prompt}</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {qq.options.map((o) => {
                      const selected = kbaAnswers[qq.id] === o.label;
                      return (
                        <button key={o.label} type="button" onClick={() => setKbaAnswers((a) => ({ ...a, [qq.id]: o.label }))}
                          style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${selected ? P.green : P.line}`, background: selected ? '#f0fdf4' : '#fff', color: selected ? '#14532d' : '#374151', fontWeight: selected ? 700 : 500, cursor: 'pointer' }}>
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {err && <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.6rem', fontWeight: 600 }}>{err}</p>}
              <button type="button" style={cta} onClick={submitKba} disabled={kbaLocked}>Confirm &amp; see who&apos;s searching →</button>
              {/* DL challenge — the stronger, instant option (verified level 'id'). */}
              <button type="button" onClick={() => { track('wsfy_dl_start', {}); setShowDlScan(true); }}
                style={{ width: '100%', marginTop: 12, background: '#fff', border: `1.5px solid ${P.green}`, color: P.green, borderRadius: 12, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                🛡️ Verify instantly with your license
              </button>
              {kbaLocked && <a href="/contact" style={{ display: 'inline-block', marginTop: 12, color: P.green, fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}>Contact support</a>}
            </div>
          ))}
        </div>

        {/* Trust — privacy promise + badges + testimonials + stats. Shown on the entry step. */}
        {step === 'about' && (
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{ background: '#fff', border: `1px solid ${P.line}`, borderRadius: 14, padding: '1.1rem 1.25rem' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 800, color: P.green, fontSize: '0.95rem' }}>🔒 We will never sell your data. Ever.</p>
              <p style={{ margin: 0, fontSize: '0.86rem', color: P.mut, lineHeight: 1.55 }}>
                Your information is used only to match your record and show who&apos;s searching for you — never sold, never shared with advertisers or third parties. You control what&apos;s visible, and you can remove yourself anytime.
              </p>
              <div style={{ marginTop: '0.9rem' }}><TrustBadges /></div>
            </div>
            <Testimonials />
            <StatStrip />
          </div>
        )}
      </div>
      <ColorLandingFooter bg={P.greenDark} fg="rgba(255,255,255,0.78)" accent="#bbf7d0" />
    </main>
  );
};

const Spinner = ({ title, P }) => (
  <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
    <div style={{ width: 46, height: 46, border: `4px solid ${P.bg}`, borderTopColor: P.green, borderRadius: '50%', margin: '0 auto 1.1rem', animation: 'spin 0.8s linear infinite' }} />
    <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: P.ink }}>{title}</h2>
    <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
  </div>
);

export default WsfyLandingPage;
