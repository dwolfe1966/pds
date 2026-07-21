import React, { useState, useEffect, useRef } from 'react';
import { captureEmail, getCapturedEmail } from '../services/emailCapture';
import { track } from '../services/trackingService';

/**
 * OnboardingReveal — a ~15s "building the report" interstitial shown AFTER the SERP results and BEFORE the
 * SUP/Payment (owner 2026-07-21, per-flow config). Mirrors the v11 BV loader: a two-phase anticipation
 * timeline that reveals the enrichment categories we search (incarceration, sex-offender, social, …), and —
 * if we don't already have the visitor's email — freezes mid-way for an email gate before finishing. On
 * completion it calls onDone() (the caller navigates to the flow's dest). Self-contained; no data fetch.
 */
const SCAN = [
  ['⚖️', 'Criminal & incarceration records'],
  ['🚨', 'Sex-offender registry'],
  ['🌐', 'Social & online profiles'],
  ['📍', 'Address history'],
  ['👥', 'Relatives & associates'],
  ['📞', 'Phone numbers & emails'],
  ['💼', 'Employment & education'],
  ['🏠', 'Property, assets & records'],
];
const PRE_MS = 8000;   // 0 → GATE
const POST_MS = 7000;  // GATE → 100 (≈15s total)
const GATE_PCT = 60;

export default function OnboardingReveal({ person = {}, onDone, variant = 'onboarding' }) {
  const name = person.fullName || 'this person';
  const location = person.location || '';
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState('pre'); // 'pre' | 'gate' | 'post'
  const hasEmail = useRef((() => { try { return !!getCapturedEmail(); } catch { return false; } })());
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const doneRef = useRef(false);

  useEffect(() => { track('onboarding_start', { variant }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === 'gate') return undefined; // frozen for the email gate
    const isPre = phase === 'pre';
    const start = isPre ? 0 : GATE_PCT;
    const end = isPre ? GATE_PCT : 100;
    const dur = isPre ? PRE_MS : POST_MS;
    let elapsed = 0; const tick = 120;
    const id = setInterval(() => {
      elapsed += tick;
      const t = Math.min(1, elapsed / dur);
      setPct(Math.round(start + (end - start) * t));
      if (t < 1) return;
      clearInterval(id);
      if (isPre) { setPhase(hasEmail.current ? 'post' : 'gate'); return; }
      if (!doneRef.current) { doneRef.current = true; track('onboarding_complete', { variant }); onDone && onDone(); }
    }, tick);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const submitEmail = (e) => {
    e.preventDefault();
    const em = email.trim();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setEmailErr('Please enter a valid email address.'); return; }
    captureEmail(em, { source: 'onboarding', variant });
    hasEmail.current = true;
    track('email_capture', { source: 'onboarding', variant }); // NO email value (PII boundary)
    setPhase('post');
  };

  const revealed = Math.ceil((pct / 100) * SCAN.length);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'linear-gradient(160deg,#0b3d1f 0%,#0d5d2f 100%)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.85 }}>Compiling report</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4 }}>{name}</div>
          {location && <div style={{ fontSize: '0.9rem', opacity: 0.85, marginTop: 2 }}>📍 {location}</div>}
        </div>

        {/* progress bar */}
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: '#facc15', transition: 'width 0.15s linear' }} />
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.78rem', opacity: 0.85, marginTop: 4 }}>{pct}%</div>

        {/* enrichment category checklist */}
        <div style={{ marginTop: '1.25rem', display: 'grid', gap: 8 }}>
          {SCAN.map(([ic, lbl], i) => {
            const done = i < revealed;
            return (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.92rem', opacity: done ? 1 : 0.45, transition: 'opacity 0.3s' }}>
                <span aria-hidden="true" style={{ width: 22 }}>{ic}</span>
                <span style={{ flex: 1 }}>{lbl}</span>
                <span aria-hidden="true">{done ? '✓' : '…'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* email gate — frozen mid-way when we don't have an email yet */}
      {phase === 'gate' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
          <form onSubmit={submitEmail} style={{ width: '100%', maxWidth: 380, background: '#fff', color: '#111827', borderRadius: 14, padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.15rem', fontWeight: 800 }}>Almost ready — where should we send {name}'s report?</h3>
            <p style={{ margin: '0 0 0.9rem', fontSize: '0.85rem', color: '#4b5563' }}>Enter your email to unlock the full results.</p>
            <input type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 0.85rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: 8, outline: 'none' }} autoFocus />
            {emailErr && <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: 6 }}>{emailErr}</div>}
            <button type="submit" style={{ width: '100%', marginTop: 12, padding: '0.85rem', fontSize: '1rem', fontWeight: 800, color: '#fff', background: '#0d5d2f', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Continue →</button>
          </form>
        </div>
      )}
    </div>
  );
}
