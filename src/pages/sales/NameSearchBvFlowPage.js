import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../../api';
import { track } from '../../services/trackingService';
import { gtmSearchSubmit } from '../../services/gtm';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { isBvFlowEnabled } from '../../services/featureFlags';
import { setSearchContext } from '../../services/searchContext';
import { deriveThinMatchFlags, persistThinMatch } from '../../services/thinMatch';
import { appendSearch } from '../../services/visitorSearchLog';
import US_STATES from './usStates';
import loader from './LoaderPage.module.css';

/**
 * ⚠️ SCAFFOLD — BeenVerified-style OPTIONAL funnel flow (name vertical).
 *
 * Owner decisions (2026-07-11), see docs/design/funnel-mimic-plan.md:
 *   • Gating: MANUAL feature flag, OFF by default (isBvFlowEnabled). Internal/manual
 *     test first — reach it via ?flow=bv or REACT_APP_ENABLE_BV_FLOW=true.
 *   • Structure-faithful to BeenVerified: progressive input DRIP → long ANTICIPATION
 *     loader that CARRIES the payoff (loader-replaces-teaser, no blurred SUP) →
 *     EMAIL CAPTURE mid-loader (their key tactic, being tested) → paywall.
 *   • Guardrails KEPT: disclosed trial terms + self-serve cancel downstream; email
 *     capture shows a consent line and the email VALUE never enters analytics
 *     (PII boundary — docs/EVENTS_CATALOG.md §2).
 *
 * This is a skeleton to iterate on: the phases, gating, and event wiring are real;
 * the visual polish and the final paywall hand-off are intentionally minimal and
 * marked with TODOs.
 */

const DRIP_STEPS = ['name', 'location']; // add 'details' etc. as we flesh it out
const LOADER_MS = 9000;                   // TODO: tune toward BV's ~60–90s anticipation
const EMAIL_PROMPT_AT = 0.5;              // capture email at ~50% (their "frozen 75%" tactic, softened)

/** Persist the mid-loader email as a REMARKETING LEAD (not an account). */
function stashBvLead(email, query) {
  try {
    sessionStorage.setItem('bvLead', JSON.stringify({ email, query, at: null }));
  } catch { /* ignore */ }
  // TODO(area iv): POST this lead to the remarketing/email backend so it feeds the
  // abandoned/remarketing pipeline. No backend exists yet — see
  // docs/design/email-platform-plan.md (Phase 1). Until then it's tab-local only.
}

const NameSearchBvFlowPage = () => {
  const navigate = useNavigate();
  useLandingTrack('name', 'bv'); // landing_view + persists funnel entry (variant 'bv')

  const [phase, setPhase] = useState('drip'); // 'drip' | 'loader'
  const [stepIdx, setStepIdx] = useState(0);
  const [query, setQuery] = useState({ firstName: '', lastName: '', state: '' });

  // Guard: flow is optional/off by default. Send disabled traffic to the default funnel.
  if (!isBvFlowEnabled()) return <Navigate to="/name/landing" replace />;

  const step = DRIP_STEPS[stepIdx];

  const advance = (patch) => {
    setQuery((q) => ({ ...q, ...patch }));
    track('search_step', { step, search_type: 'name', variant: 'bv' });
    if (stepIdx < DRIP_STEPS.length - 1) setStepIdx((i) => i + 1);
    else setPhase('loader');
  };

  if (phase === 'loader') {
    return <BvLoader query={query} navigate={navigate} />;
  }

  // ── DRIP: one question per screen (progressive commitment) ──────────────────
  return (
    <main style={S.page}>
      <div style={S.card}>
        <p style={S.eyebrow}>Step {stepIdx + 1} of {DRIP_STEPS.length}</p>
        {step === 'name' && <NameStep query={query} onNext={advance} />}
        {step === 'location' && <LocationStep query={query} onNext={advance} />}
      </div>
    </main>
  );
};

function NameStep({ query, onNext }) {
  const [first, setFirst] = useState(query.firstName);
  const [last, setLast] = useState(query.lastName);
  return (
    <>
      <h1 style={S.h1}>Who are you looking for?</h1>
      <input style={S.input} placeholder="First name" value={first} onChange={(e) => setFirst(e.target.value)} />
      <input style={S.input} placeholder="Last name" value={last} onChange={(e) => setLast(e.target.value)} />
      <button
        style={S.cta}
        disabled={!first.trim() || !last.trim()}
        onClick={() => onNext({ firstName: first.trim(), lastName: last.trim() })}
      >
        Continue
      </button>
    </>
  );
}

function LocationStep({ query, onNext }) {
  const [state, setState] = useState(query.state);
  return (
    <>
      <h1 style={S.h1}>Where do they live?</h1>
      <select style={S.input} value={state} onChange={(e) => setState(e.target.value)}>
        {US_STATES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...S.cta, flex: 1 }} disabled={!state} onClick={() => onNext({ state })}>Continue</button>
        {/* "I'm not sure" escape — keeps users moving (owner-approved BV pattern) */}
        <button style={{ ...S.ctaGhost }} onClick={() => onNext({ state: '' })}>I&apos;m not sure</button>
      </div>
    </>
  );
}

/**
 * The anticipation loader that CARRIES the payoff. Runs the real search, shows a
 * long progress animation, and interrupts mid-way to capture an email lead.
 */
function BvLoader({ query, navigate }) {
  const [pct, setPct] = useState(0);
  const [askEmail, setAskEmail] = useState(false);
  const [emailDone, setEmailDone] = useState(false);
  const resultCountRef = useRef(0);
  const searchDoneRef = useRef(false);

  // Fire the search once (independent of the animation timeline).
  useEffect(() => {
    track('loader_start', { search_type: 'name' });
    let cancelled = false;
    (async () => {
      try {
        const res = await api.searchPeople({ firstName: query.firstName, lastName: query.lastName, state: query.state || undefined, type: 'name' });
        if (cancelled) return;
        const count = (res.data || []).length;
        resultCountRef.current = count;
        track('search_submit', { type: 'name', resultCount: count, variant: 'bv' });
        gtmSearchSubmit({ search_type: 'name', result_count: count, state: query.state || undefined });
        appendSearch({ type: 'name', query, resultCount: count });
        persistThinMatch(deriveThinMatchFlags(res.rawResponse || res, { identityCount: count }));
        if (res.searchContext) setSearchContext(res.searchContext);
        try {
          sessionStorage.setItem('nameSearchResults', JSON.stringify({
            results: res.data || [], query, searchContext: res.searchContext || {}, pagination: res.pagination || {},
          }));
        } catch { /* ignore */ }
      } catch (err) {
        track('search_failed', { type: 'name', variant: 'bv', errorMessage: err?.message });
      } finally {
        searchDoneRef.current = true;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drive the anticipation timeline; pause at the email gate until it's handled.
  // Uses an elapsed-ms counter (not wall-clock) so the gate can freeze it cleanly.
  useEffect(() => {
    let elapsed = 0;
    const tick = 150;
    const id = setInterval(() => {
      elapsed += tick;
      const p = Math.min(1, elapsed / LOADER_MS);
      if (p >= EMAIL_PROMPT_AT && !emailDone) { setAskEmail(true); return; } // freeze at the gate
      setPct(Math.round(p * 100));
      if (p >= 1 && searchDoneRef.current) {
        clearInterval(id);
        track('loader_complete', { search_type: 'name', result_count: resultCountRef.current, variant: 'bv' });
        // TODO: BeenVerified routes straight to the PAYWALL here (loader-replaces-teaser).
        // For the scaffold we hand off to the existing results page; switch to the
        // paywall/signup once the BV paywall screen is wired.
        navigate('/name/search-result');
      }
    }, tick);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailDone]);

  return (
    <main className={loader.loaderMain}>
      <div className={loader.loaderCard}>
        <div className={loader.spinner} />
        <h2 className={loader.heading}>Building your report</h2>
        <p className={loader.phaseMessage}>Searching public records for {query.firstName} {query.lastName}…</p>
        <div className={loader.progressBarWrap}>
          <span className={loader.progressBarFill} style={{ width: `${pct}%` }} />
        </div>
        <div className={loader.dataPoints}>
          <span>Contact info</span><span>Address history</span><span>Relatives</span>
          <span>Public records</span><span>Social profiles</span>
        </div>
      </div>

      {askEmail && !emailDone && (
        <EmailGate
          onSubmit={(email) => {
            stashBvLead(email, query);
            // PII boundary: never put the email value in the analytics event.
            track('email_capture', { search_type: 'name', variant: 'bv', step: 'loader' });
            setEmailDone(true);
            setAskEmail(false);
          }}
        />
      )}
    </main>
  );
}

function EmailGate({ onSubmit }) {
  const [email, setEmail] = useState('');
  const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (
    <div style={S.overlay}>
      <div style={S.gate}>
        <h3 style={S.h1}>Almost there — where should we send your results?</h3>
        <input style={S.input} type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button style={S.cta} disabled={!ok} onClick={() => onSubmit(email.trim())}>See my results</button>
        {/* Consent line — CAN-SPAM/privacy guardrail (kept even though structure copies BV). */}
        <p style={S.fine}>
          By continuing you agree to receive emails about your results and can unsubscribe anytime.
          We never notify the person you searched.
        </p>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7faf8', padding: '1.5rem' },
  card: { width: '100%', maxWidth: 440, background: '#fff', borderRadius: 12, padding: '1.75rem', boxShadow: '0 6px 24px rgba(0,0,0,.08)' },
  eyebrow: { color: '#0d5d2f', fontSize: 13, fontWeight: 600, margin: '0 0 .5rem' },
  h1: { fontSize: 20, margin: '0 0 1rem', color: '#111' },
  input: { width: '100%', padding: '.75rem', margin: '0 0 .75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 16, boxSizing: 'border-box' },
  cta: { padding: '.75rem 1.25rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', width: '100%' },
  ctaGhost: { padding: '.75rem 1rem', background: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 50 },
  gate: { width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, padding: '1.5rem' },
  fine: { fontSize: 12, color: '#6b7280', margin: '.75rem 0 0' },
};

export default NameSearchBvFlowPage;
