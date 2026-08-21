import React from 'react';
import { useBrand } from '../../services/brand';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useFunnelFlow } from '../../services/funnelFlow';
import AreaMap from '../../components/AreaMap';
import { properCaseName } from '../../components/PersonAvatar';
import {
  C, page, wrap, card, Continuity, IdentityHeader, OffenderFlag, CountChips,
  UnlockCta, Disclaimer, ResolveLoader, Section, maskName,
  useHomeFactsSubject, useHomeFactsResolve, useRequireName,
} from './homefactsShared';

/**
 * v9 — "Mirror HomeFacts" (permutation P7). Maximum visual continuity: a registration-details layout
 * (photo box + details table + a blue "VIEW CRIMINAL RECORD" button) that reads like the next page of the
 * same offender file. TWO-STEP. NOTE: highest compliance care — keep the "possible record — verify" flag
 * prominent; we do NOT re-assert registry status as fact (values are locked/"verify inside").
 */
const CFG = { variant: 'homefacts-v9', flow: 'sexOffender', partnerBrand: 'homefacts' };

const HF_BLUE = '#1a5fb4';
const DETAIL_ROWS = ['DOB', 'Sex', 'Height', 'Weight', 'Eyes / Hair', 'Registered address'];

export default function HomeFactsLandingV9Page() {
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
    const first = properCaseName(p.fullName).split(' ')[0];
    return (
      <main style={page} className="hfv9">
        <div style={wrap}>
          <Continuity />
          <div style={card}>
            <IdentityHeader person={p} />
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <OffenderFlag subject={S.subject} />
              <CountChips person={p} />
              <AreaMap city={S.city} state={S.state} label={p.location || S.locLabel} accent={C.accent} />
              {rels.length > 0 && (
                <Section title={`Relatives & associates (${Rec.relatives || rels.length})`}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {rels.map((r, i) => <span key={i} style={{ fontSize: 13, color: C.ink2, background: '#f3f4f6', borderRadius: 8, padding: '5px 10px' }}>{maskName(r.name)}{r.relation ? ` · ${r.relation}` : ''}</span>)}
                  </div>
                </Section>
              )}
              <UnlockCta label={`Unlock ${first}'s full record →`} onClick={R.unlock} scopeClass="hfv9" />
            </div>
          </div>
          <Disclaimer brandName={brand.name} />
        </div>
      </main>
    );
  }

  if (R.loading) return <main style={page}><div style={wrap}><Continuity /><ResolveLoader fullName={S.fullName} initial={S.initial} state={S.state} /></div></main>;

  // ── shell: registration-details mirror ──
  return (
    <main style={page} className="hfv9">
      <div style={wrap}>
        <Continuity />
        <div style={{ ...card, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: C.ink, lineHeight: 1.2 }}>{S.fullName} — Registration Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '128px 1fr', gap: 16, alignItems: 'start' }}>
            {/* Photo box (mirrors HomeFacts' "Picture Not Provided") */}
            <div style={{ height: 150, borderRadius: 10, border: `1px solid ${C.line}`, background: '#111827', color: '#9aa4ad', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', padding: 8 }}>
              <span style={{ fontSize: 34 }} aria-hidden="true">👤</span>
              <span style={{ fontSize: 11 }}>🔒 Photo — unlock to check</span>
            </div>
            {/* Details table (values locked) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ color: C.mut }}>Last known area</span><span style={{ fontWeight: 700, color: C.ink }}>{S.locLabel || '—'}</span></div>
              {DETAIL_ROWS.map((k) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: `1px solid ${C.line}`, paddingTop: 6 }}>
                  <span style={{ color: C.mut }}>{k}</span><span style={{ color: C.mut }} aria-hidden="true">🔒 locked</span>
                </div>
              ))}
            </div>
          </div>

          <OffenderFlag subject={S.subject} />

          {/* Blue "VIEW CRIMINAL RECORD" button (mirrors the HomeFacts CTA) */}
          <button type="button" onClick={R.resolveProfile} disabled={R.loading} className="hfv9-icta"
            style={{ background: HF_BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '14px 20px', fontSize: 16, fontWeight: 800, letterSpacing: '.02em', cursor: 'pointer', opacity: R.loading ? 0.7 : 1 }}>
            VIEW {S.fullName.toUpperCase()}'S CRIMINAL RECORD →
          </button>
          <style>{'.hfv9-mcta{display:none}@media(max-width:640px){.hfv9-mcta{display:block}.hfv9-icta{display:none}.hfv9{padding-bottom:96px}}'}</style>
          <div className="hfv9-mcta" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: `1px solid ${C.line}`, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 16px rgba(0,0,0,0.10)', zIndex: 50 }}>
            <button type="button" onClick={R.resolveProfile} disabled={R.loading} style={{ width: '100%', background: HF_BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '14px 20px', fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: R.loading ? 0.7 : 1 }}>VIEW CRIMINAL RECORD →</button>
          </div>
        </div>
        <Disclaimer brandName={brand.name} />
      </div>
    </main>
  );
}
