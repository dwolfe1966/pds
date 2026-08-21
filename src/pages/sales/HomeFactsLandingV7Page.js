import React from 'react';
import { useBrand } from '../../services/brand';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useFunnelFlow } from '../../services/funnelFlow';
import AreaMap from '../../components/AreaMap';
import { properCaseName } from '../../components/PersonAvatar';
import {
  C, page, wrap, card, Continuity, IdentityHeader, OffenderFlag, CountChips, ReportIncludes,
  UnlockCta, Disclaimer, ResolveLoader, Section, maskName, pl,
  useHomeFactsSubject, useHomeFactsResolve, useRequireName,
} from './homefactsShared';

/**
 * v7 — "Full Dossier" (permutation P5). Bets on BREADTH: the complete identity file — photo/booking check,
 * map, and every category HomeFacts didn't have (relatives, addresses, phones, criminal). TWO-STEP.
 */
const CFG = { variant: 'homefacts-v7', flow: 'sexOffender', partnerBrand: 'homefacts' };

function PhotoSlot({ person }) {
  const hasPhoto = person && (person.photo || person.image || person.imageUrl);
  if (hasPhoto) return null; // real avatar already shows in the header
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: `1px dashed ${C.line}`, borderRadius: 12, padding: '12px 14px', background: '#fafafa' }}>
      <span style={{ fontSize: 26 }} aria-hidden="true">📷</span>
      <div style={{ fontSize: 13, color: C.ink2 }}><b>Photos & booking images</b><br /><span style={{ color: C.mut }}>Check for mugshots / registry photos on record</span></div>
      <span style={{ marginLeft: 'auto', color: C.mut }} aria-hidden="true">🔒</span>
    </div>
  );
}

export default function HomeFactsLandingV7Page() {
  const brand = useBrand();
  useLandingTrack('name', CFG.variant);
  useFunnelFlow(CFG.flow);
  const S = useHomeFactsSubject();
  useRequireName(S.hasName, S.search);
  const R = useHomeFactsResolve({ ...S, variant: CFG.variant, flow: CFG.flow, partnerBrand: CFG.partnerBrand });
  if (!S.hasName) return null;

  if (R.active) {
    const p = R.active; const Rec = p.records || {};
    const rels = (p.relatives || []).filter((r) => r && r.name).slice(0, 6);
    const locs = (p.locations || []).filter(Boolean).slice(0, 6);
    const first = properCaseName(p.fullName).split(' ')[0];
    return (
      <main style={page} className="hfv7">
        <div style={wrap}>
          <Continuity />
          <div style={card}>
            <IdentityHeader person={p} />
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <OffenderFlag subject={S.subject} />
              <CountChips person={p} />
              <PhotoSlot person={p} />
              <AreaMap city={S.city} state={S.state} label={p.location || S.locLabel} accent={C.accent} />
              {rels.length > 0 && (
                <Section title={`Relatives & associates (${Rec.relatives || rels.length})`}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {rels.map((r, i) => <span key={i} style={{ fontSize: 13, color: C.ink2, background: '#f3f4f6', borderRadius: 8, padding: '5px 10px' }}>{maskName(r.name)}{r.relation ? ` · ${r.relation}` : ''}</span>)}
                  </div>
                </Section>
              )}
              {(Rec.phone > 0 || Rec.email > 0 || Rec.address > 0) && (
                <Section title="Contact & addresses">
                  <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.7 }}>
                    {Rec.phone > 0 && <div>📞 {pl(Rec.phone, 'number')} on file · (•••) •••-••••</div>}
                    {Rec.email > 0 && <div>✉️ {pl(Rec.email, 'email', 'emails')} on file · ••••@••••</div>}
                    {Rec.address > 0 && <div>📍 {pl(Rec.address, 'address', 'addresses')} on record</div>}
                  </div>
                </Section>
              )}
              <UnlockCta label={`Unlock ${first}'s full report →`} onClick={R.unlock} scopeClass="hfv7" />
            </div>
          </div>
          <Disclaimer brandName={brand.name} />
        </div>
      </main>
    );
  }

  if (R.loading) return <main style={page}><div style={wrap}><Continuity /><ResolveLoader fullName={S.fullName} initial={S.initial} state={S.state} /></div></main>;

  return (
    <main style={page} className="hfv7">
      <div style={wrap}>
        <Continuity />
        <div style={card}>
          <IdentityHeader fullName={S.fullName} initial={S.initial} sub={S.locLabel || 'Public records on file'} />
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <OffenderFlag subject={S.subject} />
            <UnlockCta label={`See ${S.fullName}'s full profile →`} onClick={R.resolveProfile} loading={R.loading} scopeClass="hfv7" />
            <PhotoSlot person={null} />
            <AreaMap city={S.city} state={S.state} accent={C.accent} />
            <ReportIncludes fullName={S.fullName} />
          </div>
        </div>
        <Disclaimer brandName={brand.name} />
      </div>
    </main>
  );
}
