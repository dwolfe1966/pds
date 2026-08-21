import React from 'react';
import { useBrand } from '../../services/brand';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useFunnelFlow } from '../../services/funnelFlow';
import {
  C, page, wrap, card, Continuity, 
  UnlockCta, Disclaimer, ResolveLoader,
  useHomeFactsSubject, useHomeFactsResolve, useRequireName,
} from './homefactsShared';

/**
 * v10 — "Record Document" (permutation P10). Skips the identity profile and lands on the CRIMINAL RECORD
 * itself, rendered as a redacted document (values blurred). Feels like the record they clicked for is right
 * there — one unlock away. ONE-STEP (resolve on the unlock tap).
 */
const CFG = { variant: 'homefacts-v10', flow: 'sexOffender', partnerBrand: 'homefacts' };

const RECORD_FIELDS = [
  ['Offense', 'Lewd or lascivious acts'],
  ['Charge(s)', 'PC 288(a) — felony'],
  ['Court / case no.', 'Superior Court · CR-████████'],
  ['Conviction date', '██ / ██ / ████'],
  ['Registered address', '████ E ██████ Pl'],
  ['Registry status', 'Active — ████████'],
];

export default function HomeFactsLandingV10Page() {
  const brand = useBrand();
  useLandingTrack('name', CFG.variant);
  useFunnelFlow(CFG.flow);
  const S = useHomeFactsSubject();
  useRequireName(S.hasName, S.search);
  const R = useHomeFactsResolve({ ...S, variant: CFG.variant, flow: CFG.flow, partnerBrand: CFG.partnerBrand });
  if (!S.hasName) return null;

  if (R.loading) return <main style={page}><div style={wrap}><Continuity /><ResolveLoader fullName={S.fullName} initial={S.initial} state={S.state} /></div></main>;

  return (
    <main style={page} className="hfv10">
      <div style={wrap}>
        <Continuity />
        <div style={{ ...card, padding: 0 }}>
          {/* Document header */}
          <div style={{ background: '#111827', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.12em', opacity: 0.7 }}>CRIMINAL &amp; OFFENDER RECORD</div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{S.fullName}</div>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, background: '#b91c1c', padding: '4px 8px', borderRadius: 6 }}>SEALED</span>
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Redacted document rows */}
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden', fontFamily: 'ui-monospace,Menlo,Consolas,monospace' }}>
              {RECORD_FIELDS.map(([k, v], i) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '132px 1fr', gap: 10, padding: '10px 14px', borderTop: i ? `1px solid ${C.line}` : 'none', alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, color: C.mut, textTransform: 'uppercase', letterSpacing: '.03em' }}>{k}</span>
                  <span style={{ fontSize: 13.5, color: C.ink, filter: 'blur(4px)', userSelect: 'none' }} aria-hidden="true">{v}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12.5, color: C.mut, textAlign: 'center' }}>This record is sealed. Unlock to reveal {S.fullName}'s full criminal &amp; offender record.</div>
            <UnlockCta label={`Unlock ${S.fullName}'s record →`} onClick={R.resolveAndPay} loading={R.loading} scopeClass="hfv10" />
          </div>
        </div>
        <Disclaimer brandName={brand.name} />
      </div>
    </main>
  );
}
