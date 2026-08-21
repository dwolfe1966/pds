import React from 'react';
import { useBrand } from '../../services/brand';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useFunnelFlow } from '../../services/funnelFlow';
import AreaMap from '../../components/AreaMap';
import { properCaseName } from '../../components/PersonAvatar';
import {
  C, page, wrap, card, Continuity, IdentityHeader, CountChips, ReportIncludes, BookingSignal,
  UnlockCta, Disclaimer, ResolveLoader, Section, maskName, pl,
  useHomeFactsSubject, useHomeFactsResolve, useRequireName,
} from './homefactsShared';

/**
 * v5 — "Criminal-Record File" (permutation P3). Pays off the literal "VIEW CRIMINAL RECORD" click:
 * criminal-led framing, a MAP of the area up top, and "we found more than HomeFacts." TWO-STEP:
 * shell → "See full criminal record" resolves the individual → richer resolved view → unlock → payment.
 */
const CFG = { variant: 'homefacts-v5', flow: 'sexOffender', partnerBrand: 'homefacts' };

// Criminal-record teaser rows (locked pre-pay; the detail reveals from the licensed source post-pay).
const CRIME_ROWS = [
  ['⚖️', 'Offense & registry status'],
  ['🚔', 'Arrests, charges & court cases'],
  ['📍', 'Registered address'],
  ['📷', 'Photo on record'],
];

export default function HomeFactsLandingV5Page() {
  const brand = useBrand();
  useLandingTrack('name', CFG.variant);
  useFunnelFlow(CFG.flow);
  const S = useHomeFactsSubject();
  useRequireName(S.hasName, S.search);
  const R = useHomeFactsResolve({ ...S, variant: CFG.variant, flow: CFG.flow, partnerBrand: CFG.partnerBrand });
  if (!S.hasName) return null;

  // ── resolved individual ──
  if (R.active) {
    const p = R.active; const Rec = p.records || {};
    const rels = (p.relatives || []).filter((r) => r && r.name).slice(0, 6);
    const locs = (p.locations || []).filter(Boolean).slice(0, 6);
    const first = properCaseName(p.fullName).split(' ')[0];
    return (
      <main style={page} className="hfv5">
        <div style={wrap}>
          <Continuity />
          <div style={card}>
            <IdentityHeader person={p} />
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <BookingSignal subject={S.subject} />
              <CountChips person={p} />
              <AreaMap city={S.city} state={S.state} label={p.location || S.locLabel} accent={C.accent} />
              {rels.length > 0 && (
                <Section title={`Relatives & associates (${Rec.relatives || rels.length})`}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {rels.map((r, i) => <span key={i} style={{ fontSize: 13, color: C.ink2, background: '#f3f4f6', borderRadius: 8, padding: '5px 10px' }}>{maskName(r.name)}{r.relation ? ` · ${r.relation}` : ''}</span>)}
                  </div>
                </Section>
              )}
              {locs.length > 0 && (
                <Section title="Location history">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {locs.map((loc, i) => <div key={i} style={{ fontSize: 13, color: C.ink2 }}>📍 {typeof loc === 'string' ? loc : [loc.city, loc.state].filter(Boolean).join(', ')} <span style={{ color: C.mut, filter: 'blur(3px)' }}>· ████</span></div>)}
                  </div>
                </Section>
              )}
              <UnlockCta label={`Unlock ${first}'s full record →`} onClick={R.unlock} scopeClass="hfv5" />
            </div>
          </div>
          <Disclaimer brandName={brand.name} />
        </div>
      </main>
    );
  }

  // ── loading (after tap) ──
  if (R.loading) return <main style={page}><div style={wrap}><Continuity /><ResolveLoader fullName={S.fullName} initial={S.initial} state={S.state} /></div></main>;

  // ── shell (first paint — no search, no captcha) ──
  return (
    <main style={page} className="hfv5">
      <div style={wrap}>
        <Continuity />
        <div style={card}>
          <IdentityHeader fullName={`${S.fullName} — Criminal Record`} initial={S.initial} sub={S.locLabel || 'Public records on file'} />
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <BookingSignal subject={S.subject} />
            <AreaMap city={S.city} state={S.state} accent={C.accent} />
            <UnlockCta label={`See ${S.fullName}'s full criminal record →`} onClick={R.resolveProfile} loading={R.loading} scopeClass="hfv5" />
            <Section title="Criminal & court records">
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
                {CRIME_ROWS.map(([icon, label], i) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                    <span style={{ fontSize: 17 }} aria-hidden="true">{icon}</span>
                    <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: C.ink }}>{label}</div>
                    <span style={{ color: C.mut }} aria-hidden="true">🔒</span>
                  </div>
                ))}
              </div>
            </Section>
            <ReportIncludes fullName={S.fullName} />
          </div>
        </div>
        <Disclaimer brandName={brand.name} />
      </div>
    </main>
  );
}
