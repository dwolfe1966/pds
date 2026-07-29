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
// Intent-aware capability hook (the pre-pay tease). Keyed on funnel flow. `flag` flows render a prominent
// warning-styled hook (the homefacts sex-offender experience — a POSSIBLE-match flag, framed to verify, never
// an assertion; the corroborated record itself is revealed post-pay from our licensed source).
const CAPABILITY_COPY = {
  dating: {
    header: (n) => `Before you meet ${n} — run a full safety check`,
    items: [['🛡️', 'Sex-offender & criminal check'], ['🪪', 'Identity, age & photo verification'], ['💍', 'Relationship status'], ['📍', 'Current location']],
  },
  background: {
    header: (n) => `Background check on ${n}`,
    items: [['🚔', 'Arrest & criminal records'], ['🏛️', 'Court & case records'], ['🛡️', 'Sex-offender check'], ['🪪', 'Identity, age & photo']],
  },
  sexOffender: {
    flag: true,
    header: (n) => `Possible offender record for ${n} — unlock to verify`,
    items: [['🚔', 'Full criminal & offender record'], ['🏛️', 'Court & case records'], ['📍', 'Registered address & aliases'], ['🪪', 'Identity & photo']],
  },
  publicRecords: {
    header: (n) => `Public records for ${n}`,
    items: [['📍', 'Addresses & phone numbers'], ['👪', 'Relatives & associates'], ['🚔', 'Criminal & court records'], ['💍', 'Marriage & divorce']],
  },
};
const capabilityCopy = (flow) => CAPABILITY_COPY[flow] || CAPABILITY_COPY.dating;
// Flows whose HOOK is the capability tease → render even with no pre-pay records (criminal/SO are post-pay).
const CAPABILITY_FLOWS = new Set(['dating', 'background', 'sexOffender', 'publicRecords']);

// No-mugshot placeholder colors, cycled per row so multiple no-photo records read as distinct people
// (matches InmateBookingTeaser — the proven high-CVR inmate teaser).
const PLACEHOLDER_BG = [
  { bg: '#dbe9f2', fg: '#5b7f9c' },
  { bg: '#dcfce7', fg: '#4d9e78' },
  { bg: '#fde2e7', fg: '#c77a8c' },
];

// anonymize: hide the subject's IDENTITY (name in headers + mugshot faces) while still proving records exist —
// for phone/email searches where the owner's identity IS the paywalled prize (a name search already knows it).
// subjectLabel overrides the generic stand-in (e.g. "this number's owner").
export default function SignalTeaser({ subject, flow = 'general', viewerRelation = 'prospect', stage = 'pre-signup', strict = false, accent = '#0d5d2f', dark = '#0a4a25', anonymize = false, subjectLabel, proof = false }) {
  const [res, setRes] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!subject || (!subject.lastName && !subject.firstName)) return undefined;
    getPersonSignals({ subject, viewerRelation, stage, flow, strict })
      .then((r) => { if (alive) setRes(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [subject && subject.firstName, subject && subject.lastName, subject && subject.state, subject && subject.city, subject && subject.age, flow, viewerRelation, stage, strict]);

  if (!res || res.suppressed) return null;
  const { signals, lead, secondary } = res;
  const hasReal = ((signals.marriageDivorce && signals.marriageDivorce.count) || 0) + ((signals.booking && signals.booking.count) || 0) > 0;
  if (!hasReal && !CAPABILITY_FLOWS.has(flow)) return null; // no hollow teaser (except capability-hook flows)

  const fullName = anonymize
    ? (subjectLabel || 'this person')
    : ([subject.firstName, subject.lastName].filter(Boolean).join(' ') || 'this person');

  // Proof-first challenger (variant=proof): reveal ONE real, checkable finding fully in the clear — the opposite
  // of a blurred "unlock to verify" tease. Only fires when a REAL record exists; otherwise render nothing and
  // let the SRP show its standard/honest state (fabricating a "proof" would break the entire premise).
  if (proof) return hasReal ? <ProofPanel signals={signals} fullName={fullName} accent={accent} dark={dark} /> : null;

  const isFlag = capabilityCopy(flow).flag && lead === 'capability';

  return (
    <div style={{ marginTop: '1rem', border: `1px solid ${isFlag ? '#f59e0b' : `${accent}33`}`, borderRadius: 12, background: isFlag ? '#fffbeb' : '#f0fdf4', padding: '0.9rem 1rem' }}>
      {renderSignal(lead, signals, { prominent: true, fullName, subject, dark, strict, flow, anonymize })}
      {(secondary || []).map((k) => (
        <div key={k} style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #d1d5db' }}>
          {renderSignal(k, signals, { prominent: false, fullName, subject, dark, strict, flow, anonymize })}
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

function Capability({ fullName, dark, flow }) {
  const copy = capabilityCopy(flow);
  return (
    <div>
      {copy.flag ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span aria-hidden="true" style={{ fontSize: 18 }}>⚠️</span>
          <span style={{ fontWeight: 800, color: '#92400e', fontSize: '0.95rem' }}>{copy.header(fullName)}</span>
        </div>
      ) : (
        <Header dark={dark}>{copy.header(fullName)}</Header>
      )}
      <div style={{ display: 'grid', gap: 5 }}>
        {copy.items.map(([ic, label]) => (
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
function Booking({ records, prominent, fullName, dark, strict, anonymize }) {
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
                👤{r.mugshotUrl && <img src={r.mugshotUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: anonymize ? 'blur(6px)' : undefined }} />}
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

// Proof-First panel (variant=proof). Picks the single STRONGEST real record and shows its concrete,
// sanity-checkable details in the clear — no blur, no "unlock to verify". Every field shown is one the record
// actually carries (dropped if absent), so we never fabricate.
//
// CRITICAL FRAMING: at the SRP the teaser runs NON-strict, so these records are matched by NAME (+state), NOT
// corroborated to this specific person (no age/gender check). So we assert about the RECORD UNDER THE NAME
// ("a real record is on file under this name" — true), NEVER about the person ("{fullName} has a record" —
// unproven, and a defamation posture for a same-name stranger's criminal record). Hence the honest badge
// "Real record · match unconfirmed" and the "check it against what you know" ask — the proof is that the record
// is real and specific, and the searcher confirms the identity, not us.
function ProofPanel({ signals, fullName, accent, dark }) {
  const booking = (signals.booking || {}).records || [];
  const md = (signals.marriageDivorce || {}).records || [];
  const total = booking.length + md.length;

  let icon = '📄'; let label = 'record'; let bits = [];
  if (booking.length) {
    const r = booking[0];
    const year = (String(r.bookingDate || '').match(/\d{4}/) || [])[0];
    const status = cleanReleaseStatus(r.releaseStatus, r.recordType);
    const where = r.facility || r.county || r.state || null;
    icon = r.recordType === 'court' ? '🏛️' : '⚖️';
    label = r.recordType === 'court' ? 'court record' : 'incarceration record';
    bits = [where, status, year && `booked ${year}`].filter(Boolean);
  } else if (md.length) {
    const r = md[0];
    const isDiv = r.recordType === 'divorce';
    icon = isDiv ? '💔' : '💍';
    label = isDiv ? 'divorce record' : 'marriage record';
    bits = [r.county, r.state, (isDiv ? r.divorceDate : r.marriageDate)].filter(Boolean);
  } else {
    return null;
  }

  const rest = Math.max(0, total - 1);
  return (
    <div style={{ marginTop: '1rem', border: `1px solid ${accent}33`, borderRadius: 12, background: '#f0fdf4', padding: '0.95rem 1.05rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '3px 8px', borderRadius: 999 }}>Real record · match unconfirmed</span>
        <span style={{ fontSize: '0.8rem', color: '#5b7484' }}>Shown free — no blur</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 800, color: dark, fontSize: '0.98rem' }}>A real {label} is on file under this name</span>
      </div>
      {bits.length > 0 && (
        <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#374151' }}>{bits.join(' · ')}</p>
      )}
      <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#3f6212', lineHeight: 1.5 }}>
        Check it against what you already know about {fullName}. {rest > 0
          ? <>Continue to confirm it's the right person and unlock the other <strong>{rest} record{rest === 1 ? '' : 's'}</strong> on file, in full.</>
          : <>Continue to confirm it's the right person and unlock this record in full.</>}
      </p>
    </div>
  );
}
