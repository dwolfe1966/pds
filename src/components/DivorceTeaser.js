import React, { useEffect, useState } from 'react';
import { fetchLifeEvents } from '../services/lifeEventsService';

/**
 * Divorce/marriage teaser for the v12 (divorce) funnel — the conversion hook, mirroring InmateBookingTeaser on
 * the inmate flow. PRE-SIGNUP + name-search surface, so LOOSE (name+state) — "records matching this name" — and
 * the real hook is the RELATIONSHIP reveal: WHO they married/divorced (spouse/ex-spouse name), teased then locked.
 * Safe-by-default: renders NOTHING until records exist.
 */
export default function DivorceTeaser({ firstName, lastName, state, personAge, personGender, strict = false, accent = '#7c3aed', dark = '#5b21b6' }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!lastName) return undefined;
    fetchLifeEvents({ firstName, lastName, state, age: personAge, gender: personGender })
      .then((r) => { if (alive) setData(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [firstName, lastName, state, personAge, personGender]);

  let records = ((data && data.records) || []).filter((r) => r.recordType === 'divorce' || r.recordType === 'marriage');
  // STRICT (SUP / specific-profile): tighter than the loose name-search teaser. Divorce/marriage records carry no
  // age to corroborate, so we (1) drop records whose age IS present but far off the profile, and (2) show at most
  // the top 2 as a conservative "possible match — verify" rather than boasting a full count of same-name records.
  if (strict) {
    const pa = parseInt(personAge, 10);
    if (Number.isFinite(pa)) records = records.filter((r) => !Number.isFinite(r.age) || Math.abs(r.age - pa) <= 3);
    records = records.slice(0, 2);
  }
  if (!records.length) return null;

  const divorces = records.filter((r) => r.recordType === 'divorce').length;
  const marriages = records.filter((r) => r.recordType === 'marriage').length;
  const parts = [];
  if (marriages) parts.push(`${marriages} marriage record${marriages === 1 ? '' : 's'}`);
  if (divorces) parts.push(`${divorces} divorce record${divorces === 1 ? '' : 's'}`);
  const summary = parts.join(' + ') || `${records.length} record${records.length === 1 ? '' : 's'}`;
  const fullName = [firstName, lastName].filter(Boolean).join(' ');
  const preview = records.slice(0, 4);

  return (
    <div style={{ marginTop: '1rem', border: `1px solid ${accent}33`, borderRadius: 12, background: '#faf7fe', padding: '0.9rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>🔒</span>
        <span style={{ fontWeight: 800, color: dark, fontSize: '0.95rem' }}>
          {strict
            ? <>Possible marriage/divorce record for {fullName} — verify this is the right person</>
            : <>{summary} found for {fullName}{state ? ` in ${state}` : ''}</>}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {preview.map((r, i) => {
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
      <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: '#5b4884', lineHeight: 1.45 }}>
        Continue to reveal who {firstName || 'this person'} married or divorced, dates, county &amp; court, and case status.
      </p>
    </div>
  );
}
