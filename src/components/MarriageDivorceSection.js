import React, { useEffect, useState } from 'react';
import { fetchLifeEvents } from '../services/lifeEventsService';

/**
 * Marriage & Divorce records for a person (first-party /api/life-events → Enformion). Powers the marriage/divorce
 * angle + enriches any profile with WHO the person married/divorced (the relationship signal). Self-gates: renders
 * nothing until there are records. Records are name+state matched at query time; divorce/marriage carry no age, so
 * we frame as "possible match — verify" (no age corroboration is possible here — unlike incarceration).
 *
 * context: 'search' (a person's report) | 'identity' (the member's OWN exposure view).
 */
export default function MarriageDivorceSection({ firstName, lastName, state, personAge, personGender, records: recordsProp, context = 'search' }) {
  const [data, setData] = useState(null);
  const isIdentity = context === 'identity';

  useEffect(() => {
    let alive = true;
    if (recordsProp || !lastName) return undefined; // parent supplied records → skip the fetch
    fetchLifeEvents({ firstName, lastName, state, age: personAge, gender: personGender })
      .then((r) => { if (alive) setData(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [firstName, lastName, state, personAge, personGender, recordsProp]);

  const src = recordsProp || (data && data.records) || [];
  const records = src.filter((r) => r.recordType === 'divorce' || r.recordType === 'marriage');
  if (!records.length) return null;

  return (
    <section style={{ margin: '20px 0', border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #eef2f7', background: '#faf7fb' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>💍 {isIdentity ? 'Your Marriage & Divorce Records' : 'Marriage & Divorce Records'} <span style={{ color: '#7c3aed' }}>({records.length})</span></h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>{isIdentity
          ? 'Public marriage & divorce records matching your name & state — part of what’s exposed about you.'
          : 'Public records matching this name & state. Not age-verified — confirm identity before relying on any record.'}</p>
      </div>
      <div>
        {records.map((r, i) => {
          const isDivorce = r.recordType === 'divorce';
          const other = isDivorce ? r.exSpouseName : r.spouseName;
          const date = isDivorce ? r.divorceDate : r.marriageDate;
          const loc = [r.county && r.county !== 'Unknown' ? r.county : null, r.state].filter(Boolean).join(', ');
          return (
            <div key={i} style={{ padding: '12px 18px', borderBottom: i < records.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16 }} aria-hidden="true">{isDivorce ? '💔' : '💍'}</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14.5 }}>
                  {isDivorce ? 'Divorced' : 'Married'}{other ? <> · <span style={{ color: '#7c3aed' }}>{other}</span></> : ''}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: isDivorce ? '#9333ea' : '#166534', background: isDivorce ? '#f3e8ff' : '#dcfce7', borderRadius: 999, padding: '2px 8px' }}>{isDivorce ? 'Divorce record' : 'Marriage record'}</span>
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 3 }}>
                {[date && `${isDivorce ? 'Divorced' : 'Married'} ${date}`, r.marriageDate && isDivorce && `married ${r.marriageDate}`, loc].filter(Boolean).join(' · ')}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 18px', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #eef2f7' }}>
        Public records. Not a consumer report — do not use for FCRA-covered decisions.
      </div>
    </section>
  );
}
