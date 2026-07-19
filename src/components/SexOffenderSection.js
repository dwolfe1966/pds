import React from 'react';

/**
 * Sex-offender registry matches — the HIGHEST-STAKES record type we show. NSOPW matches on name OR alias, so the
 * primary offender name is often different from the searched name; a wrong attribution is serious harm + liability.
 * Design rules (owner 2026-07-19):
 *   - Records passed in are ALREADY tight-corroborated by the parent (age + gender + state) — this component only renders.
 *   - NEVER assert "X is a sex offender." Frame every row as a POSSIBLE match and push the user to the OFFICIAL
 *     registry to verify (registryUrl). Show the matched alias transparently so it's clear WHY the record surfaced.
 *   - Self-gates: renders nothing when there are no corroborated matches.
 */
export default function SexOffenderSection({ records = [], personName }) {
  if (!records.length) return null;
  return (
    <section style={{ margin: '20px 0', border: '2px solid #fca5a5', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #fee2e2', background: '#fef2f2' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#991b1b' }}>🚨 Possible Sex-Offender Registry Matches <span>({records.length})</span></h2>
        <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.5 }}>
          These public registry records list <strong>{personName || 'this name'}</strong> as a legal name or alias, and the
          age/location are consistent with this profile. <strong>This is NOT a confirmation of identity.</strong> Registry
          entries can share a name or alias with an unrelated person — <strong>verify each record on the official state
          registry</strong> before drawing any conclusion.
        </p>
      </div>
      <div style={{ display: 'grid', gap: 0 }}>
        {records.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 18px', borderBottom: i < records.length - 1 ? '1px solid #fef2f2' : 'none' }}>
            <div style={{ flexShrink: 0, width: 84, height: 100, borderRadius: 8, overflow: 'hidden', background: '#e5e7eb', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#94a3b8' }}>
              👤
              {r.photoUrl && <img src={r.photoUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: 15 }}>{r.name}{r.age ? `, ${r.age}` : ''}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', background: '#fee2e2', borderRadius: 999, padding: '2px 8px' }}>Possible match — verify</span>
              </div>
              {r.matchedAlias && (
                <div style={{ fontSize: 12.5, color: '#7f1d1d', marginTop: 3 }}>Registered alias matched: <strong>{r.matchedAlias}</strong> (registry lists a different legal name)</div>
              )}
              <div style={{ fontSize: 13, color: '#475569', marginTop: 3 }}>
                {[[r.county, r.state].filter(Boolean).join(', '), r.jurisdiction].filter(Boolean).join(' · ')}
              </div>
              {r.registryUrl && (
                <a href={r.registryUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: 13, fontWeight: 700, color: '#991b1b' }}>
                  Verify on the official registry →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 18px', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #fee2e2' }}>
        Source: Dru Sjodin National Sex Offender Public Website (NSOPW). Public data, not a consumer report — do not
        use for FCRA-covered decisions (employment, tenant, credit). Verify identity before acting on any record.
      </div>
    </section>
  );
}
