import React from 'react';
import { useBrand } from '../../services/brand';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useFunnelFlow } from '../../services/funnelFlow';
import AreaMap from '../../components/AreaMap';
import {
  C, page, wrap, card, Continuity, IdentityHeader, OffenderFlag, ReportIncludes,
  UnlockCta, Disclaimer, ResolveLoader,
  useHomeFactsSubject, useHomeFactsResolve, useRequireName,
} from './homefactsShared';

/**
 * v6 — "Instant Map" (permutation P4). ZERO search on the landing → NO Turnstile on arrival, ever. Pure
 * params + a big MAP + a criminal-record teaser. ONE-STEP: the unlock tap runs the BC search (captcha only
 * at that high-intent moment) and goes straight to email-on-payment. Tests: does removing all landing
 * friction beat a richer resolved page?
 */
const CFG = { variant: 'homefacts-v6', flow: 'sexOffender', partnerBrand: 'homefacts' };

export default function HomeFactsLandingV6Page() {
  const brand = useBrand();
  useLandingTrack('name', CFG.variant);
  useFunnelFlow(CFG.flow);
  const S = useHomeFactsSubject();
  useRequireName(S.hasName, S.search);
  const R = useHomeFactsResolve({ ...S, variant: CFG.variant, flow: CFG.flow, partnerBrand: CFG.partnerBrand });
  if (!S.hasName) return null;

  if (R.loading) return <main style={page}><div style={wrap}><Continuity /><ResolveLoader fullName={S.fullName} initial={S.initial} state={S.state} /></div></main>;

  return (
    <main style={page} className="hfv6">
      <div style={wrap}>
        <Continuity />
        <div style={card}>
          <IdentityHeader fullName={S.fullName} initial={S.initial} sub={S.locLabel || 'Public records on file'} />
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <AreaMap city={S.city} state={S.state} height={220} accent={C.accent} />
            <OffenderFlag subject={S.subject} />
            <UnlockCta label={`Unlock ${S.fullName}'s record →`} onClick={R.resolveAndPay} loading={R.loading} scopeClass="hfv6" />
            <div style={{ fontSize: 12.5, color: C.mut, textAlign: 'center' }}>No wait — full criminal record, court cases, current address &amp; photo inside.</div>
            <ReportIncludes fullName={S.fullName} />
          </div>
        </div>
        <Disclaimer brandName={brand.name} />
      </div>
    </main>
  );
}
