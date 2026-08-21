import React from 'react';
import { useBrand } from '../../services/brand';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useFunnelFlow } from '../../services/funnelFlow';
import AreaMap from '../../components/AreaMap';
import {
  C, page, wrap, card, Continuity, IdentityHeader, 
  UnlockCta, Disclaimer, ResolveLoader,
  useHomeFactsSubject, useHomeFactsResolve, useRequireName,
} from './homefactsShared';

/**
 * v8 — "Proximity / Safety" (permutation P6). Reframes to family-safety emotion: where is this offender,
 * how close, and get alerts if they move. Big MAP hero. ONE-STEP (resolve on the unlock tap). A different
 * buyer emotion than the record-file arms.
 */
const CFG = { variant: 'homefacts-v8', flow: 'sexOffender', partnerBrand: 'homefacts' };

const SAFETY = [
  ['📍', 'Exactly where they live', "Current registered address on a map"],
  ['🔔', 'Move alerts', 'Get notified if their address changes'],
  ['🚔', 'What they were convicted of', 'Offense, charges & court records'],
  ['👪', 'Who they live with', 'Relatives & known associates'],
];

export default function HomeFactsLandingV8Page() {
  const brand = useBrand();
  useLandingTrack('name', CFG.variant);
  useFunnelFlow(CFG.flow);
  const S = useHomeFactsSubject();
  useRequireName(S.hasName, S.search);
  const R = useHomeFactsResolve({ ...S, variant: CFG.variant, flow: CFG.flow, partnerBrand: CFG.partnerBrand });
  if (!S.hasName) return null;

  if (R.loading) return <main style={page}><div style={wrap}><Continuity /><ResolveLoader fullName={S.fullName} initial={S.initial} state={S.state} /></div></main>;

  return (
    <main style={page} className="hfv8">
      <div style={wrap}>
        <Continuity />
        <div style={card}>
          <IdentityHeader fullName={S.fullName} initial={S.initial} sub={S.locLabel ? `Registered in ${S.locLabel}` : 'Public records on file'} />
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.ink, lineHeight: 1.2 }}>Is {S.fullName} near you or your family?</div>
            <AreaMap city={S.city} state={S.state} height={230} accent={C.accent} />
            <UnlockCta label={`See ${S.fullName}'s location & record →`} onClick={R.resolveAndPay} loading={R.loading} scopeClass="hfv8" />
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.mut, margin: '0 0 8px' }}>Protect your family — see</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SAFETY.map(([icon, label, sub]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18 }} aria-hidden="true">{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{label}</div>
                      <div style={{ fontSize: 12, color: C.mut }}>{sub}</div>
                    </div>
                    <span style={{ color: C.mut }} aria-hidden="true">🔒</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <Disclaimer brandName={brand.name} />
      </div>
    </main>
  );
}
