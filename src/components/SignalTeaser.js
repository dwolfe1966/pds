import React, { useEffect, useState } from 'react';
import { getPersonSignals } from '../services/personSignals';
import { cleanReleaseStatus } from '../services/incarcerationService';

/**
 * Unified, engine-driven teaser. Consumes ONE getPersonSignals result and renders the resolved LEAD prominently
 * + capped "also found" SECONDARY — the single teaser for every funnel surface (landing/SERP/SUP/Payment).
 * Presence is data-driven; emphasis (lead/secondary) is decided by the engine's FLOW_PRIORITY. Atomic per-signal
 * renderers so each signal shows exactly once (no overlap).
 *
 * Safe-by-default: renders NOTHING until the engine resolves, and nothing at all when there's no real signal
 * (except the dating flow, whose hook IS the safety-check capability tease). Async pop-in: appears when data is
 * ready; it's additive, below the CTA. The "also found" secondary can be disabled via REACT_APP_SIGNALS_AUGMENT=0
 * (engine kill-switch → lead-only).
 */
const CAPABILITIES = [
  ['🛡️', 'Sex-offender & criminal check'],
  ['🪪', 'Identity, age & photo verification'],
  ['💍', 'Relationship status'],
  ['📍', 'Current location'],
];

// No-mugshot placeholder colors, cycled per row so multiple no-photo records read as distinct people
// (matches InmateBookingTeaser — the proven high-CVR inmate teaser).
const PLACEHOLDER_BG = [
  { bg: '#dbe9f2', fg: '#5b7f9c' },
  { bg: '#dcfce7', fg: '#4d9e78' },
  { bg: '#fde2e7', fg: '#c77a8c' },
];

export default function SignalTeaser({ subject, flow = 'general', viewerRelation = 'prospect', stage = 'pre-signup', strict = false, accent = '#0d5d2f', dark = '#0a4a25' }) {
  const [res, setRes] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!subject || (!subject.lastName && !subject.firstName)) return undefined;
    getPersonSignals({ subject, viewerRelation, stage, flow, strict })
      .then((r) => { if (alive) setRes(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [subject && subject.firstName, subject && subject.lastName, subject && subject.state, subject && subject.age, flow, viewerRelation, stage, strict]);

  if (!res || res.suppressed) return null;
  const { signals, lead, secondary } = res;
  const hasReal = ((signals.marriageDivorce && signals.marriageDivorce.count) || 0) + ((signals.booking && signals.booking.count) || 0) > 0;
  if (!hasReal && flow !== 'dating') return null; // no hollow teaser (except dating, where capability IS the hook)

  const fullName = [subject.firstName, subject.lastName].filter(Boolean).join(' ') || 'this person';

  return (
    <div style={{ marginTop: '1rem', border: `1px solid ${accent}33`, borderRadius: 12, background: '#f0fdf4', padding: '0.9rem 1rem' }}>
      {renderSignal(lead, signals, { prominent: true, fullName, subject, dark, strict })}
      {(secondary || []).map((k) => (
        <div key={k} style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #d1d5db' }}>
          {renderSignal(k, signals, { prominent: false, fullName, subject, dark, strict })}
        </div>
      ))}
      {/* The booking lead renders its own tailored unlock line (CVR parity); other leads get the generic CTA. */}
      {lead !== 'booking' && (
        <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#3f6212', lineHeight: 1.45 }}>
          Continue to unlock the full report on {fullName}.
        </p>
      )}
    </div>
  );
}

function renderSignal(key, signals, ctx) {
  switch (key) {
    case 'marriageDivorce': return <MarriageDivorce records={(signals.marriageDivorce || {}).records || []} {...ctx} />;
    case 'booking':         return <Booking records={(signals.booking || {}).records || []} {...ctx} />;
    case 'capability':      return <Capability {...ctx} />;
    default:                return null;
  }
}

function Header({ children, dark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span aria-hidden="true" style={{ fontSize: 18 }}>🔒</span>
      <span style={{ fontWeight: 800, color: dark, fontSize: '0.95rem' }}>{children}</span>
    </div>
  );
}

function Capability({ fullName, dark }) {
  return (
    <div>
      <Header dark={dark}>Before you meet {fullName} — run a full safety check</Header>
      <div style={{ display: 'grid', gap: 5 }}>
        {CAPABILITIES.map(([ic, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.83rem', color: '#374151' }}>
            <span aria-hidden="true">{ic}</span><span>{label}</span><span style={{ marginLeft: 'auto', fontSize: 12 }}>🔒</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarriageDivorce({ records, prominent, fullName, dark, strict }) {
  if (!records.length) return null;
  const married = records.filter((r) => r.recordType === 'marriage').length;
  const divorced = records.filter((r) => r.recordType === 'divorce').length;
  const summary = [married && `${married} marriage record${married === 1 ? '' : 's'}`, divorced && `${divorced} divorce record${divorced === 1 ? '' : 's'}`].filter(Boolean).join(' + ');
  if (!prominent) return <div style={{ fontSize: '0.85rem', color: '#374151' }}><strong style={{ color: dark }}>💍 Also found:</strong> {summary}</div>;
  return (
    <div>
      <Header dark={dark}>{strict ? <>Possible marriage/divorce record for {fullName} — verify this is the right person</> : <>{summary} found for {fullName}</>}</Header>
      <div style={{ display: 'grid', gap: 6 }}>
        {records.slice(0, 4).map((r, i) => {
          const isDivorce = r.recordType === 'divorce';
          const other = isDivorce ? r.exSpouseName : r.spouseName;
          const date = isDivorce ? r.divorceDate : r.marriageDate;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#374151' }}>
              <span aria-hidden="true">{isDivorce ? '💔' : '💍'}</span>
              <span style={{ fontWeight: 700 }}>{isDivorce ? 'Divorced' : 'Married'}</span>
              {other ? <span style={{ filter: 'blur(4px)', userSelect: 'none', color: dark, fontWeight: 700 }}>{other}</span> : null}
              {date ? <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#6b7280' }}>{date}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Booking renderer at FULL parity with InmateBookingTeaser (the proven 7.15%-CVR inmate teaser): cycling
// placeholder colors, charges preview, facility preview (loose only), and a tailored "unlock" line built from
// what the matched records actually carry. Strict mode → "Possible … record — verify" (specific-person surfaces).
function Booking({ records, prominent, fullName, dark, strict }) {
  if (!records.length) return null;
  const inCustody = records.filter((r) => r.recordType !== 'court').length;
  const courtOnly = records.filter((r) => r.recordType === 'court').length;
  const summary = [inCustody && `${inCustody} incarceration record${inCustody === 1 ? '' : 's'}`, courtOnly && `${courtOnly} court record${courtOnly === 1 ? '' : 's'}`].filter(Boolean).join(' + ') || `${records.length} record${records.length === 1 ? '' : 's'}`;
  if (!prominent) return <div style={{ fontSize: '0.85rem', color: '#374151' }}><strong style={{ color: dark }}>⚖️ Also found:</strong> {summary}</div>;
  const charges = [...new Set(records.flatMap((r) => r.charges || []).filter(Boolean))];
  // Facility names are public institution names — safe credibility proof on the loose teaser; kept off strict.
  const facilities = strict ? [] : [...new Set(records.map((r) => r.facility).filter(Boolean))];
  const has = (f) => records.some((r) => (f === 'mug' ? r.mugshotUrl : f === 'charges' ? (r.charges || []).length : r[f]));
  const unlockItems = [has('mug') && 'mugshots', has('charges') && 'charges', has('bookingDate') && 'booking dates', 'facility & custody details'].filter(Boolean);
  return (
    <div>
      <Header dark={dark}>
        {strict
          ? <>Possible {courtOnly && !inCustody ? 'court' : 'incarceration'} record for {fullName} — verify this is the right person</>
          : <>{summary} found for {fullName}</>}
      </Header>
      <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
        {records.slice(0, 4).map((r, i) => {
          const ph = PLACEHOLDER_BG[i % PLACEHOLDER_BG.length];
          return (
            <div key={i} style={{ flex: '0 0 auto', width: 60, textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: 8, background: ph.bg, color: ph.fg, overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                👤{r.mugshotUrl && <img src={r.mugshotUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ fontSize: 10, color: r.recordType === 'court' ? '#b45309' : '#6b7280', marginTop: 3 }}>
                {r.recordType === 'court' ? 'Court record' : ((r.charges && r.charges.length) ? `${r.charges.length} charge${r.charges.length === 1 ? '' : 's'}` : (cleanReleaseStatus(r.releaseStatus, r.recordType) || 'Record'))}
              </div>
            </div>
          );
        })}
      </div>
      {charges.length > 0 && (
        <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#374151', lineHeight: 1.4 }}>
          <span aria-hidden="true" style={{ color: '#b91c1c' }}>⚖️ </span>{charges.slice(0, 2).join(' · ')}{charges.length > 2 ? ` +${charges.length - 2} more` : ''}
        </p>
      )}
      {facilities.length > 0 && (
        <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#374151', lineHeight: 1.4 }}>
          <span aria-hidden="true">📍 </span>{facilities.slice(0, 2).join(' · ')}{facilities.length > 2 ? ` +${facilities.length - 2} more` : ''}
        </p>
      )}
      <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#5b7484', lineHeight: 1.45 }}>Continue to unlock {unlockItems.join(', ')}.</p>
    </div>
  );
}
