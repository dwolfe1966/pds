import React, { useEffect, useState } from 'react';
import { getPersonSignals } from '../services/personSignals';
import { cleanReleaseStatus } from '../services/incarcerationService';

/**
 * Unified, engine-driven teaser (signals-augmentation Phase 1). Consumes ONE getPersonSignals result and
 * renders the resolved LEAD prominently + capped "also found" SECONDARY — instead of each surface fetching and
 * flow-checking on its own. Presence is data-driven; emphasis (lead/secondary) is decided by the engine's
 * FLOW_PRIORITY. Atomic per-signal renderers so each signal shows exactly once (no overlap).
 *
 * Gated by REACT_APP_SIGNALS_AUGMENT: at flag=0 the surfaces still render the OLD per-flow teasers (this
 * component is only mounted at flag=1), so rollback stays real. Safe-by-default: renders NOTHING until the
 * engine resolves, and nothing at all when there's no real signal (except the dating flow, whose hook IS the
 * safety-check capability tease). Async pop-in (Q4): appears when data is ready; it's additive, below the CTA.
 */
const CAPABILITIES = [
  ['🛡️', 'Sex-offender & criminal check'],
  ['🪪', 'Identity, age & photo verification'],
  ['💍', 'Relationship status'],
  ['📍', 'Current location'],
];

export default function SignalTeaser({ subject, flow = 'general', viewerRelation = 'prospect', stage = 'pre-signup', accent = '#0d5d2f', dark = '#0a4a25' }) {
  const [res, setRes] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!subject || (!subject.lastName && !subject.firstName)) return undefined;
    getPersonSignals({ subject, viewerRelation, stage, flow })
      .then((r) => { if (alive) setRes(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [subject && subject.firstName, subject && subject.lastName, subject && subject.state, flow, viewerRelation, stage]);

  if (!res || res.suppressed) return null;
  const { signals, lead, secondary } = res;
  const hasReal = ((signals.marriageDivorce && signals.marriageDivorce.count) || 0) + ((signals.booking && signals.booking.count) || 0) > 0;
  if (!hasReal && flow !== 'dating') return null; // no hollow teaser (except dating, where capability IS the hook)

  const fullName = [subject.firstName, subject.lastName].filter(Boolean).join(' ') || 'this person';

  return (
    <div style={{ marginTop: '1rem', border: `1px solid ${accent}33`, borderRadius: 12, background: '#f0fdf4', padding: '0.9rem 1rem' }}>
      {renderSignal(lead, signals, { prominent: true, fullName, subject, dark })}
      {(secondary || []).map((k) => (
        <div key={k} style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #d1d5db' }}>
          {renderSignal(k, signals, { prominent: false, fullName, subject, dark })}
        </div>
      ))}
      <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#3f6212', lineHeight: 1.45 }}>
        Continue to unlock the full report on {fullName}.
      </p>
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

function MarriageDivorce({ records, prominent, fullName, dark }) {
  if (!records.length) return null;
  const married = records.filter((r) => r.recordType === 'marriage').length;
  const divorced = records.filter((r) => r.recordType === 'divorce').length;
  const summary = [married && `${married} marriage record${married === 1 ? '' : 's'}`, divorced && `${divorced} divorce record${divorced === 1 ? '' : 's'}`].filter(Boolean).join(' + ');
  if (!prominent) return <div style={{ fontSize: '0.85rem', color: '#374151' }}><strong style={{ color: dark }}>💍 Also found:</strong> {summary}</div>;
  return (
    <div>
      <Header dark={dark}>{summary} found for {fullName}</Header>
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

function Booking({ records, prominent, fullName, dark }) {
  if (!records.length) return null;
  const inCustody = records.filter((r) => r.recordType !== 'court').length;
  const courtOnly = records.filter((r) => r.recordType === 'court').length;
  const summary = [inCustody && `${inCustody} incarceration record${inCustody === 1 ? '' : 's'}`, courtOnly && `${courtOnly} court record${courtOnly === 1 ? '' : 's'}`].filter(Boolean).join(' + ') || `${records.length} record${records.length === 1 ? '' : 's'}`;
  if (!prominent) return <div style={{ fontSize: '0.85rem', color: '#374151' }}><strong style={{ color: dark }}>⚖️ Also found:</strong> {summary}</div>;
  const charges = [...new Set(records.flatMap((r) => r.charges || []).filter(Boolean))];
  return (
    <div>
      <Header dark={dark}>{summary} found for {fullName}</Header>
      <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
        {records.slice(0, 4).map((r, i) => (
          <div key={i} style={{ flex: '0 0 auto', width: 60, textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: 8, background: '#dbe9f2', color: '#5b7f9c', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              👤{r.mugshotUrl && <img src={r.mugshotUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ fontSize: 10, color: r.recordType === 'court' ? '#b45309' : '#6b7280', marginTop: 3 }}>
              {r.recordType === 'court' ? 'Court record' : ((r.charges && r.charges.length) ? `${r.charges.length} charge${r.charges.length === 1 ? '' : 's'}` : (cleanReleaseStatus(r.releaseStatus, r.recordType) || 'Record'))}
            </div>
          </div>
        ))}
      </div>
      {charges.length > 0 && (
        <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#374151', lineHeight: 1.4 }}>
          <span aria-hidden="true" style={{ color: '#b91c1c' }}>⚖️ </span>{charges.slice(0, 2).join(' · ')}{charges.length > 2 ? ` +${charges.length - 2} more` : ''}
        </p>
      )}
    </div>
  );
}
