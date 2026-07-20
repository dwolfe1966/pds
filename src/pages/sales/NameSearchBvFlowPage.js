import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { track } from '../../services/trackingService';
import { gtmSearchSubmit } from '../../services/gtm';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { setSearchContext } from '../../services/searchContext';
import { deriveThinMatchFlags, persistThinMatch } from '../../services/thinMatch';
import { appendSearch } from '../../services/visitorSearchLog';
import { captureEmail } from '../../services/emailCapture';
import US_STATES from './usStates';
import { useBrand } from '../../services/brand';
import { ReviewStars, TrustBadges, Testimonials, UseCaseDonut, LiveStat, StatStrip } from './BvSocialProof';
import v3 from './NameLandingV3Incarceration.module.css'; // reuse v3's green header + CTA
import loader from './LoaderPage.module.css';
import InmateBookingTeaser from '../../components/InmateBookingTeaser';
import SignalTeaser from '../../components/SignalTeaser';
import { isFlow } from '../../services/funnelFlow';

// Signals-augmentation Phase 3: flag=1 → unified engine teaser; flag=0 (default) → original inmate teaser.
// v11 is HIGH-CVR inmate traffic (v3+v11 are the top inmate channel) — keep the isFlow('inmate') gate + inmate flow.
const SIGNALS_AUGMENT = process.env.REACT_APP_SIGNALS_AUGMENT === '1';

/**
 * BeenVerified-style OPTIONAL funnel flow (name vertical).
 *
 * Owner decisions (2026-07-11), see docs/design/funnel-mimic-plan.md +
 * docs/design/beenverified-funnel-teardown-2026-07.md:
 *   • v11 landing slot. Renders directly (no flag gate) — exposure is controlled by
 *     the shN split (funnelSplit.js), which routes a share of paid/SEO traffic here.
 *   • Structure-faithful to BeenVerified: a 3-step input DRIP (name → location →
 *     details+FCRA) → a long ANTICIPATION loader that CARRIES the payoff
 *     (loader-replaces-teaser) → EMAIL CAPTURE mid-loader → hand-off.
 *   • Guardrails KEPT: FCRA consent, disclosed terms downstream, self-serve cancel;
 *     email VALUE never enters analytics (PII boundary — docs/EVENTS_CATALOG.md §2).
 *
 * THREE hand-off versions (owner 2026-07-11), chosen by ?dest=:
 *   • ?dest=serp    → search-results page (least aggressive)
 *   • ?dest=sup     → the SUP teaser for the top match
 *   • ?dest=payment → straight to the paywall (faithful BV — no results shown)
 * Each is tracked as a distinct funnel arm (variant `v11-serp|v11-sup|v11-payment`).
 */

const DRIP_STEPS = ['name', 'location', 'details'];
const DESTS = ['serp', 'sup', 'payment'];
// Two-phase loader timeline. BeenVerified freezes at ~75% to capture email, then
// resumes 77→100 SLOWLY with more anticipation. Owner 2026-07-11: extend the tail.
const PRE_EMAIL_MS = 9000;    // 0 → EMAIL_AT_PCT, before the email gate
const POST_EMAIL_MS = 16000;  // EMAIL_AT_PCT → 100, AFTER email — the extended tail
const EMAIL_AT_PCT = 75;      // freeze here for the email gate (BV's "frozen 75%")

// Status lines cycled during the extended post-email tail.
const POST_MESSAGES = [
  'Cross-referencing public records…',
  'Compiling address history…',
  'Checking for possible relatives…',
  'Scanning available court records…',
  'Finalizing your report…',
];

// Categories that "check off" as the loader climbs — the BV anticipation checklist.
const SCAN_ITEMS = ['Home address', 'Phone numbers', 'Social media', 'Photos', 'Court records', 'Relatives'];
// Panels carouseled inside the loader to sell the payoff while it stalls.
const PANELS = [
  { icon: '🏠', t: 'Address & property', d: 'Current and past addresses, property records' },
  { icon: '📞', t: 'Phone & email', d: 'Known numbers and email addresses' },
  { icon: '⚖️', t: 'Criminal & traffic', d: 'Available court and public records' },
  { icon: '👥', t: 'Relatives & associates', d: 'Possible relatives and connections' },
  { icon: '🔔', t: 'Ongoing monitoring', d: 'Get alerted when new records appear' },
];

function readDest() {
  try {
    const d = new URLSearchParams(window.location.search).get('dest');
    return DESTS.includes(d) ? d : 'serp';
  } catch { return 'serp'; }
}

/** Route to the chosen destination once the loader completes. */
function handoff(navigate, dest, firstResult) {
  const id = firstResult?.id;
  if (dest === 'payment') {
    // Faithful BV: no results shown — end on "create your account", then Payment.
    // A visitor can't pay without an account, so we route to signup and let it
    // redirect to /payment (redirect target must be whitelisted in useSignup —
    // '/payment' passes; the bare 'Payment' would fail the open-redirect guard).
    if (id) {
      try {
        sessionStorage.setItem(`result_${id}`, JSON.stringify(firstResult));
        sessionStorage.setItem('selectedPersonId', id);
      } catch { /* ignore */ }
    }
    navigate('/signup?redirect=/payment');
  } else if (dest === 'sup' && id) {
    try { sessionStorage.setItem(`result_${id}`, JSON.stringify(firstResult)); } catch { /* ignore */ }
    navigate(`/search/${id}`);
  } else {
    // serp — also the fallback when sup has no top match to target.
    navigate('/name/search-result');
  }
}

const NameSearchBvFlowPage = () => {
  const navigate = useNavigate();
  const dest = useMemo(readDest, []);
  useLandingTrack('name', `v11-${dest}`); // landing_view + persists funnel entry

  const [phase, setPhase] = useState('drip'); // 'drip' | 'loader'
  const [stepIdx, setStepIdx] = useState(0);
  const [query, setQuery] = useState({ firstName: '', lastName: '', city: '', state: '', middleName: '', age: '' });

  const step = DRIP_STEPS[stepIdx];

  const advance = (patch) => {
    const next = { ...query, ...patch };
    setQuery(next);
    track('search_step', { step, search_type: 'name', variant: `v11-${dest}` });
    if (stepIdx < DRIP_STEPS.length - 1) setStepIdx((i) => i + 1);
    else setPhase('loader');
  };

  if (phase === 'loader') {
    return <BvLoader query={query} dest={dest} navigate={navigate} />;
  }

  // ── DRIP: one question per screen (progressive commitment) ──────────────────
  return (
    <>
      <V3Header />
      <main style={S.page}>
        <div style={S.dripCol}>
        <div style={S.card}>
          {/* No "Step X of N" counter — a visible step count signals commitment ahead
              (friction). BeenVerified hides the drip length; the "I'm not sure" escapes
              carry momentum instead. (Owner 2026-07-11.) */}
          {step === 'name' && <NameStep query={query} onNext={advance} />}
          {step === 'location' && <LocationStep query={query} onNext={advance} />}
          {step === 'details' && <DetailsStep query={query} dest={dest} onNext={advance} />}
          {/* Inmate referral (v3-family paid split routed here) + we have a name → show the booking teaser.
              v11 converts 300% better on inmate traffic; leading the last step with real records reinforces it.
              Self-gates to nothing when there are no records. (Owner 2026-07-19.) */}
          {step === 'details' && isFlow('inmate') && query.lastName && (
            SIGNALS_AUGMENT
              ? <SignalTeaser subject={{ firstName: query.firstName, lastName: query.lastName, state: query.state }} flow="inmate" viewerRelation="prospect" stage="pre-signup" />
              : <InmateBookingTeaser firstName={query.firstName} lastName={query.lastName} state={query.state} />
          )}
          {/* Trust footer inside the card (BV-style social proof). */}
          <ReviewStars />
          <TrustBadges />
        </div>
        {/* Persistent social proof beside/under the card. Donut only on the first
            step so later steps stay lean. Figures/testimonials — see BvSocialProof.js
            (StatStrip = industry-defensible; testimonials/reviews = placeholder). */}
        <StatStrip />
        <Testimonials />
        {step === 'name' && <UseCaseDonut />}
        </div>
      </main>
    </>
  );
};

function V3Header() {
  const brand = useBrand();
  return (
    <header className={v3.nav}>
      <a href="/" className={v3.logo}>{brand.name}</a>
    </header>
  );
}

function NameStep({ query, onNext }) {
  const [first, setFirst] = useState(query.firstName);
  const [last, setLast] = useState(query.lastName);
  return (
    <>
      <h1 style={S.h1}>Who are you looking for?</h1>
      <input style={S.input} placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
      <input style={S.input} placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
      <button className={v3.cta} style={{ opacity: (!first.trim() || !last.trim()) ? 0.5 : 1 }} disabled={!first.trim() || !last.trim()} onClick={() => onNext({ firstName: first.trim(), lastName: last.trim() })}>
        Continue
      </button>
    </>
  );
}

function LocationStep({ query, onNext }) {
  const [state, setState] = useState(query.state);
  const [city, setCity] = useState(query.city);
  return (
    <>
      <h1 style={S.h1}>Where do they live?</h1>
      <input style={S.input} placeholder="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} />
      <select style={S.input} value={state} onChange={(e) => setState(e.target.value)}>
        {US_STATES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <button className={v3.cta} style={{ opacity: !state ? 0.5 : 1 }} disabled={!state} onClick={() => onNext({ state, city: city.trim() })}>Continue</button>
      {/* "I'm not sure" escape — keeps users moving (owner-approved BV pattern) */}
      <button className={v3.buttonSecondary} onClick={() => onNext({ state: '', city: '' })}>I&apos;m not sure</button>
    </>
  );
}

function DetailsStep({ query, dest, onNext }) {
  const [age, setAge] = useState(query.age);
  const [middle, setMiddle] = useState(query.middleName);
  const [fcra, setFcra] = useState(false);
  const submit = () => {
    // FCRA consent as a micro-commitment (also legally required). Tracked distinctly.
    track('fcra_agree', { search_type: 'name', variant: `v11-${dest}` });
    onNext({ age: age.trim(), middleName: middle.trim() });
  };
  return (
    <>
      <h1 style={S.h1}>A few more details help us narrow it down.</h1>
      <input style={S.input} placeholder="Approximate age (optional)" value={age} onChange={(e) => setAge(e.target.value)} />
      <input style={S.input} placeholder="Middle name (optional)" value={middle} onChange={(e) => setMiddle(e.target.value)} />
      <label style={S.consent}>
        <input type="checkbox" checked={fcra} onChange={(e) => setFcra(e.target.checked)} />
        <span>I understand this report may not be used for employment, tenant, credit, or other FCRA-regulated purposes.</span>
      </label>
      <button className={v3.cta} style={{ opacity: !fcra ? 0.5 : 1 }} disabled={!fcra} onClick={submit}>See results</button>
      <button className={v3.buttonSecondary} disabled={!fcra} onClick={submit}>I&apos;m not sure</button>
    </>
  );
}

/**
 * The anticipation loader that CARRIES the payoff. Runs the real search, shows a
 * long progress animation with a category checklist + carouseled panels, and
 * interrupts mid-way to capture an email lead before handing off per `dest`.
 */
function BvLoader({ query, dest, navigate }) {
  const [pct, setPct] = useState(0);
  const [panelIdx, setPanelIdx] = useState(0);
  const [askEmail, setAskEmail] = useState(false);
  const [tlPhase, setTlPhase] = useState('pre'); // 'pre' (0→75%) | 'post' (75→100%, extended)
  const firstResultRef = useRef(null);
  const resultCountRef = useRef(0);
  const searchDoneRef = useRef(false);
  const variant = `v11-${dest}`;

  // Fire the search once (independent of the animation timeline).
  useEffect(() => {
    track('loader_start', { search_type: 'name', variant });
    let cancelled = false;
    (async () => {
      try {
        const res = await api.searchPeople({
          firstName: query.firstName,
          lastName: query.lastName,
          middleName: query.middleName || undefined,
          age: query.age || undefined,
          city: query.city || undefined,
          state: query.state || undefined,
          type: 'name',
        });
        if (cancelled) return;
        const data = res.data || [];
        const count = data.length;
        resultCountRef.current = count;
        if (data[0]) {
          const r = data[0];
          firstResultRef.current = {
            ...r, id: r.id || r.extId, extId: r.extId,
            fullName: r.fullName || 'Unknown', location: r.location || '', ageRange: r.ageRange || '', provider: r.provider,
          };
        }
        track('search_submit', { type: 'name', resultCount: count, variant });
        gtmSearchSubmit({ search_type: 'name', result_count: count, state: query.state || undefined });
        appendSearch({ type: 'name', query, resultCount: count });
        persistThinMatch(deriveThinMatchFlags(res.rawResponse || res, { identityCount: count }));
        if (res.searchContext) setSearchContext(res.searchContext);
        try {
          sessionStorage.setItem('nameSearchResults', JSON.stringify({
            results: data, query, searchContext: res.searchContext || {}, pagination: res.pagination || {},
          }));
        } catch { /* ignore */ }
      } catch (err) {
        track('search_failed', { type: 'name', variant, errorMessage: err?.message });
      } finally {
        searchDoneRef.current = true;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotate the anticipation panels while the loader runs.
  useEffect(() => {
    const id = setInterval(() => setPanelIdx((i) => (i + 1) % PANELS.length), 2500);
    return () => clearInterval(id);
  }, []);

  // Two-phase anticipation timeline. PRE climbs 0→EMAIL_AT_PCT then freezes for the
  // email gate; POST resumes EMAIL_AT_PCT→100 over a longer duration (the extended
  // tail) and hands off once the search has also resolved. Re-runs on tlPhase change.
  useEffect(() => {
    const isPre = tlPhase === 'pre';
    const startPct = isPre ? 0 : EMAIL_AT_PCT;
    const endPct = isPre ? EMAIL_AT_PCT : 100;
    const dur = isPre ? PRE_EMAIL_MS : POST_EMAIL_MS;
    let elapsed = 0;
    const tick = 150;
    const id = setInterval(() => {
      elapsed += tick;
      const t = Math.min(1, elapsed / dur);
      setPct(Math.round(startPct + (endPct - startPct) * t));
      if (t < 1) return;
      if (isPre) { clearInterval(id); setAskEmail(true); return; } // freeze at the gate
      // POST done — hand off once the search has also resolved (else hold at 100%).
      if (searchDoneRef.current) {
        clearInterval(id);
        track('loader_complete', { search_type: 'name', result_count: resultCountRef.current, variant });
        handoff(navigate, dest, firstResultRef.current);
      }
    }, tick);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tlPhase]);

  const revealed = Math.ceil((pct / 100) * SCAN_ITEMS.length);
  const panel = PANELS[panelIdx];
  const isPost = tlPhase === 'post';

  return (
    <>
      <V3Header />
      <main className={loader.loaderMain}>
      <div className={loader.loaderCard}>
        <div className={loader.spinner} />
        <h2 className={loader.heading}>{isPost ? 'Finalizing your report' : 'Building your report'}</h2>
        <p className={loader.phaseMessage}>
          {isPost ? POST_MESSAGES[panelIdx % POST_MESSAGES.length] : `Searching public records for ${query.firstName} ${query.lastName}…`}
        </p>
        <div style={S.pctRow}><span style={S.pct}>{pct}%</span></div>
        <div className={loader.progressBarWrap}>
          <span className={loader.progressBarFill} style={{ width: `${pct}%` }} />
        </div>

        {/* Category checklist — items check off as the search "progresses". */}
        <ul style={S.checklist}>
          {SCAN_ITEMS.map((item, i) => (
            <li key={item} style={{ ...S.checkItem, opacity: i < revealed ? 1 : 0.4 }}>
              <span>{i < revealed ? '✓' : '○'}</span> {item}
            </li>
          ))}
        </ul>

        {/* Carouseled anticipation panel — sells the payoff while stalling. */}
        <div style={S.panel}>
          <span style={{ fontSize: 22 }}>{panel.icon}</span>
          <div>
            <div style={{ fontWeight: 600 }}>{panel.t}</div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{panel.d}</div>
          </div>
        </div>
        <p style={S.dontLeave}>Please don&apos;t close this window — your report is being compiled.</p>
        {/* Social proof fills the dwell time (BV runs counters + testimonials here). */}
        <LiveStat />
        <Testimonials intervalMs={3500} />
      </div>

      {askEmail && !isPost && (
        <EmailGate
          name={`${query.firstName} ${query.lastName}`}
          onSubmit={(email) => {
            // General capture: localStorage (durable + signup pre-fill) + push to our
            // lead endpoint. The email VALUE lives here, NOT on the analytics event.
            captureEmail(email, { source: 'bv_loader', variant, dest, search_type: 'name' });
            // PII boundary: never put the email value in the analytics event.
            track('email_capture', { search_type: 'name', variant, step: 'loader' });
            setAskEmail(false);
            setTlPhase('post'); // resume the extended post-email tail
          }}
        />
      )}
      </main>
    </>
  );
}

function EmailGate({ name, onSubmit }) {
  const [email, setEmail] = useState('');
  const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (
    <div style={S.overlay}>
      <div style={S.gate}>
        <h3 style={S.h1}>Almost there — where should we send {name.trim() ? `${name}'s` : 'your'} results?</h3>
        <input style={S.input} type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className={v3.cta} style={{ opacity: !ok ? 0.5 : 1 }} disabled={!ok} onClick={() => onSubmit(email.trim())}>See my results</button>
        {/* Consent line — CAN-SPAM/privacy guardrail (kept even though structure copies BV). */}
        <p style={S.fine}>
          By continuing you agree to receive emails about your results and can unsubscribe anytime.
          We&apos;ll never sell your information.
        </p>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: '#f7faf8', padding: '1.5rem' },
  dripCol: { width: '100%', maxWidth: 440, display: 'grid', gap: 14, marginTop: '4vh' },
  card: { width: '100%', background: '#fff', borderRadius: 12, padding: '1.75rem', boxShadow: '0 6px 24px rgba(0,0,0,.08)' },
  eyebrow: { color: '#0d5d2f', fontSize: 13, fontWeight: 600, margin: '0 0 .5rem' },
  h1: { fontSize: 20, margin: '0 0 1rem', color: '#111' },
  input: { width: '100%', padding: '.75rem', margin: '0 0 .75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 16, boxSizing: 'border-box' },
  // Green CTAs to match the other funnels (owner 2026-07-11: sky blue was too much).
  cta: { padding: '.75rem 1.25rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', width: '100%' },
  ctaGhost: { padding: '.75rem 1rem', background: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' },
  consent: { display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#4b5563', margin: '0 0 1rem', lineHeight: 1.4 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 50 },
  gate: { width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, padding: '1.5rem' },
  fine: { fontSize: 12, color: '#6b7280', margin: '.75rem 0 0' },
  pctRow: { textAlign: 'center', margin: '.25rem 0' },
  pct: { fontSize: 28, fontWeight: 700, color: '#0d5d2f' },
  checklist: { listStyle: 'none', padding: 0, margin: '1rem 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.35rem' },
  checkItem: { fontSize: 13, color: '#374151', transition: 'opacity .3s' },
  panel: { display: 'flex', gap: 12, alignItems: 'center', padding: '.75rem', border: '1px solid #eef2f0', borderRadius: 10, background: '#fafcfb' },
  dontLeave: { fontSize: 12, color: '#9ca3af', textAlign: 'center', margin: '.75rem 0 0' },
};

export default NameSearchBvFlowPage;
