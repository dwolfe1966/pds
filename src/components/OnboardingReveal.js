import React, { useState, useEffect, useRef } from 'react';
import { captureEmail, getCapturedEmail } from '../services/emailCapture';
import { track } from '../services/trackingService';
import { getPersonSignals } from '../services/personSignals';

/**
 * OnboardingReveal — a ~15s "building the report" interstitial shown AFTER the SERP results and BEFORE the
 * SUP/Payment (owner 2026-07-21, per-flow config). Two-phase anticipation timeline that scans the enrichment
 * categories and — as data arrives — surfaces the REAL matches for the searched person (incarceration mugshots,
 * marriage/divorce records), with sex-offender/criminal shown as locked-until-report. If we don't already have
 * the visitor's email, it freezes mid-way for an email gate before finishing, then calls onDone().
 *
 * Styling matches the funnel (light surface, brand green, white cards) — no full-screen dark background.
 */
const GREEN = '#0d5d2f';
const GREEN_TINT = '#f0fdf4';
const GREEN_BORDER = '#bbf7d0';

// [icon, label, findingKey] — findingKey maps the row to real getPersonSignals data.
// 'so' = sex-offender/criminal → locked pre-pay (post-pay only); null = generic scan (checks off).
const SCAN = [
  ['⚖️', 'Criminal & incarceration records', 'booking'],
  ['🚨', 'Sex-offender registry', 'so'],
  ['💍', 'Marriage & divorce records', 'md'],
  ['🌐', 'Social & online profiles', null],
  ['📍', 'Address history', null],
  ['👥', 'Relatives & associates', null],
  ['📞', 'Phone numbers & emails', null],
  ['💼', 'Employment & education', null],
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
  const [find, setFind] = useState(null); // { bookingCount, mdCount, mugshots:[], soLocked }
  const doneRef = useRef(false);

  useEffect(() => { track('onboarding_start', { variant }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull the real enrichment matches for the searched person (same engine as the SERP teaser). Pre-signup:
  // booking + marriage/divorce populate; sex-offender/criminal stay locked until the paid report. Best-effort.
  useEffect(() => {
    let alive = true;
    const subject = { firstName: person.firstName, lastName: person.lastName, state: person.state, age: person.age };
    if (!subject.lastName) return undefined;
    getPersonSignals({ subject, viewerRelation: 'prospect', stage: 'pre-signup', flow: variant })
      .then((res) => {
        if (!alive || !res || res.suppressed) return;
        const s = res.signals || {};
        const booking = (s.booking && s.booking.records) || [];
        const md = (s.marriageDivorce && s.marriageDivorce.records) || [];
        setFind({
          bookingCount: booking.length,
          mdCount: md.length,
          mugshots: booking.map((r) => r.mugshotUrl).filter(Boolean).slice(0, 3),
          soLocked: true,
        });
      })
      .catch(() => { /* self-gates to the generic scan */ });
    return () => { alive = false; };
  }, [person.firstName, person.lastName, person.state, person.age, variant]);

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
  // Real-match status for a scan row once it's revealed. Returns { text, tone } | null (generic ✓).
  const rowStatus = (key, isRevealed) => {
    if (!isRevealed) return null;
    if (!find) return { text: '✓', tone: 'ok' };
    if (key === 'booking' && find.bookingCount > 0) return { text: `${find.bookingCount} found`, tone: 'hit' };
    if (key === 'md' && find.mdCount > 0) return { text: `${find.mdCount} found`, tone: 'hit' };
    if (key === 'so') return { text: '🔒 in report', tone: 'lock' };
    return { text: '✓', tone: 'ok' };
  };
  const totalHits = find ? (find.bookingCount + find.mdCount) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: `linear-gradient(160deg, ${GREEN_TINT} 0%, #ffffff 55%)`, color: '#111827', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem', overflowY: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.10)', border: '1px solid #e5e7eb', padding: '1.75rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: GREEN, fontWeight: 700 }}>Compiling report</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, marginTop: 4, color: '#111827' }}>{name}</div>
          {location && <div style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: 2 }}>📍 {location}</div>}
        </div>

        {/* progress bar */}
        <div style={{ height: 8, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: GREEN, transition: 'width 0.15s linear' }} />
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>{pct}%</div>

        {/* REAL matches strip — populates as the enrichment engine resolves */}
        {totalHits > 0 && (
          <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: GREEN_TINT, border: `1px solid ${GREEN_BORDER}`, borderRadius: 12 }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#166534' }}>
              {[find.bookingCount && `${find.bookingCount} booking record${find.bookingCount === 1 ? '' : 's'}`,
                find.mdCount && `${find.mdCount} marriage/divorce record${find.mdCount === 1 ? '' : 's'}`]
                .filter(Boolean).join(' · ')} found for {name}
            </div>
            {find.mugshots.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {find.mugshots.map((url, i) => (
                  <img key={i} src={url} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover', border: '1px solid #d1d5db', filter: 'blur(2.5px)' }} />
                ))}
                <span style={{ alignSelf: 'center', fontSize: '0.78rem', color: '#166534', fontWeight: 600 }}>🔒 unlocks in report</span>
              </div>
            )}
          </div>
        )}

        {/* enrichment category checklist */}
        <div style={{ marginTop: '1.25rem', display: 'grid', gap: 9 }}>
          {SCAN.map(([ic, lbl, key], i) => {
            const isRevealed = i < revealed;
            const st = rowStatus(key, isRevealed);
            const toneColor = st ? (st.tone === 'hit' ? '#166534' : st.tone === 'lock' ? '#6b7280' : GREEN) : '#9ca3af';
            return (
              <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.92rem', color: isRevealed ? '#374151' : '#9ca3af', transition: 'color 0.3s' }}>
                <span aria-hidden="true" style={{ width: 22 }}>{ic}</span>
                <span style={{ flex: 1 }}>{lbl}</span>
                <span style={{ fontSize: st && st.tone === 'hit' ? '0.8rem' : '0.92rem', fontWeight: st && st.tone === 'hit' ? 700 : 400, color: toneColor }}>
                  {st ? st.text : '…'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* email gate — frozen mid-way when we don't have an email yet */}
      {phase === 'gate' && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(17,24,39,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
          <form onSubmit={submitEmail} style={{ width: '100%', maxWidth: 380, background: '#fff', color: '#111827', borderRadius: 14, padding: '1.5rem', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 0.4rem', fontSize: '1.15rem', fontWeight: 800 }}>Almost ready — where should we send {name}'s report?</h3>
            <p style={{ margin: '0 0 0.9rem', fontSize: '0.85rem', color: '#4b5563' }}>
              {totalHits > 0
                ? `We found ${totalHits} record${totalHits === 1 ? '' : 's'}. Enter your email to unlock the full results.`
                : 'Enter your email to unlock the full results.'}
            </p>
            <input type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '0.75rem 0.85rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: 8, outline: 'none' }} autoFocus />
            {emailErr && <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: 6 }}>{emailErr}</div>}
            <button type="submit" style={{ width: '100%', marginTop: 12, padding: '0.85rem', fontSize: '1rem', fontWeight: 800, color: '#fff', background: GREEN, border: 'none', borderRadius: 8, cursor: 'pointer' }}>Continue →</button>
          </form>
        </div>
      )}
    </div>
  );
}
