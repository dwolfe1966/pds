import React, { useEffect, useState } from 'react';
import { fetchLifeEvents } from '../services/lifeEventsService';

/**
 * Dating-verification teaser ("is this person safe / real / single?") — the conversion hook for the v13
 * (dating) funnel. Two-part hook:
 *   1. CAPABILITY tease (always, when a name+state is present): the full safety check the paid report runs.
 *   2. RELATIONSHIP reveal (only when records exist): the cheap, cached marriage/divorce record — "is your
 *      date actually single?" — with the spouse/ex name blurred as the concrete pull.
 *
 * DELIBERATELY does NOT fetch sex-offender data here (owner + advisor 2026-07-19): a pre-signup name+state
 * match can't corroborate age/gender, so surfacing a "safety record" — even a blurred count — is an implicit
 * claim about a named person and the exact wrong-person harm we removed from the report. The sex-offender
 * check runs POST-PAY only, where age/gender/state corroboration gates it (SexOffenderSection). Here we only
 * PROMISE the capability; the concrete data reveal is the (cheap, safe) marriage/divorce record.
 */
const CAPABILITIES = [
  ['🛡️', 'Sex-offender & criminal safety check'],
  ['🪪', 'Identity, age & photo verification'],
  ['💍', 'Current relationship status'],
  ['📍', 'Current location & who they live with'],
];

export default function DatingTeaser({ firstName, lastName, state, personAge, personGender, strict = false, accent = '#0d5d2f', dark = '#065f46' }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!lastName) return undefined;
    // NO sexOffender flag — relationship records only (cheap + cached). Safety check is post-pay.
    fetchLifeEvents({ firstName, lastName, state, age: personAge, gender: personGender })
      .then((r) => { if (alive) setData(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [firstName, lastName, state, personAge, personGender]);

  if (!lastName) return null;

  let records = ((data && data.records) || []).filter((r) => r.recordType === 'divorce' || r.recordType === 'marriage');
  // STRICT (SUP / specific profile): drop records whose age is present but far from this person, cap to top 2.
  if (strict) {
    const pa = parseInt(personAge, 10);
    if (Number.isFinite(pa)) records = records.filter((r) => !Number.isFinite(r.age) || Math.abs(r.age - pa) <= 3);
    records = records.slice(0, 2);
  }
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'this person';
  const married = records.filter((r) => r.recordType === 'marriage').length;
  const divorced = records.filter((r) => r.recordType === 'divorce').length;
  const preview = records.slice(0, 3);

  return (
    <div style={{ marginTop: '1rem', border: `1px solid ${accent}33`, borderRadius: 12, background: '#f0fdf4', padding: '0.9rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>🛡️</span>
        <span style={{ fontWeight: 800, color: dark, fontSize: '0.95rem' }}>
          {strict
            ? <>Run a safety check on {fullName} before you meet</>
            : <>Before you meet {fullName} — run a full safety check</>}
        </span>
      </div>

      {/* Relationship reveal — the concrete, cheap record hook (blurred spouse/ex name). */}
      {records.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginBottom: 10, padding: '8px 10px', background: '#fff', borderRadius: 8, border: `1px solid ${accent}22` }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: dark }}>
            ⚠️ {[married && `${married} marriage record${married === 1 ? '' : 's'}`, divorced && `${divorced} divorce record${divorced === 1 ? '' : 's'}`].filter(Boolean).join(' + ')} found — are they really single?
          </div>
          {preview.map((r, i) => {
            const isDivorce = r.recordType === 'divorce';
            const other = isDivorce ? r.exSpouseName : r.spouseName;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: '#374151' }}>
                <span aria-hidden="true">{isDivorce ? '💔' : '💍'}</span>
                <span style={{ fontWeight: 700 }}>{isDivorce ? 'Divorced' : 'Married'}</span>
                {other ? <span style={{ filter: 'blur(4px)', userSelect: 'none', color: dark, fontWeight: 700 }}>{other}</span> : null}
                {(isDivorce ? r.divorceDate : r.marriageDate) ? <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#6b7280' }}>{isDivorce ? r.divorceDate : r.marriageDate}</span> : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Capability tease — what the full safety check covers (a promise, not a claim about this person). */}
      <div style={{ display: 'grid', gap: 5 }}>
        {CAPABILITIES.map(([ic, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.83rem', color: '#374151' }}>
            <span aria-hidden="true">{ic}</span><span>{label}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12 }}>🔒</span>
          </div>
        ))}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#3f6212', lineHeight: 1.45 }}>
        Continue to verify {firstName || 'this person'}&apos;s identity and check public safety, criminal, and relationship records.
      </p>
    </div>
  );
}
