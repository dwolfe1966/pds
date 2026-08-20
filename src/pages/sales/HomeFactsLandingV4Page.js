import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';
import { useBrand } from '../../services/brand';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useFunnelFlow } from '../../services/funnelFlow';
import { track } from '../../services/trackingService';
import { setSearchInput as gtmSetSearchInput, setSearchTarget } from '../../services/gtmContext';
import { gtmSearchSubmit, gtmTeaserView } from '../../services/gtm';
import { saveDeclaredIdentity } from '../../services/identityProfile';
import SignalTeaser from '../../components/SignalTeaser';
import { PersonAvatar, properCaseName } from '../../components/PersonAvatar';
import { US_STATES } from '../../data/usStates';

/**
 * HomeFacts landing v4 — SHELL-FIRST (owner 2026-08-20). A/B challenger to v3.
 *
 * WHY: live evidence showed v3's auto-fire-on-arrival triggers a Cloudflare Turnstile "verify you are
 * human" modal over a greyed page as the FIRST impression for cold HomeFacts traffic (the traffic most
 * likely to be challenged) — a first-page abandonment driver. v4 removes the on-mount search entirely:
 *   1. SHELL (instant, NO search, NO Turnstile): primed identity from the URL params + the compliant
 *      "possible offender record — verify" flag + what the report contains. Clean first paint.
 *   2. The CTA tap runs the BC teaser search — the tap IS the human gesture that lets Turnstile pass
 *      cleanly, and only intent-qualified visitors trigger it — then we render the resolved individual's
 *      REAL data (aliases, relatives, counts, locations). Unlock → email-on-payment.
 *
 * Single-variable difference from v3: search fires on TAP, not on mount. Everything else is identical so
 * the A/B is clean. COMPLIANCE unchanged: offender = POSSIBLE-match flag framed to verify, never asserted;
 * criminal/offender detail reveals POST-PAY from our licensed source; FCRA agreement at /payment.
 */

const CFG = { variant: 'homefacts-v4', flow: 'sexOffender', partnerBrand: 'homefacts' };

const STATE_ABBR = US_STATES.reduce((m, s) => { if (s.value) m[s.label.toLowerCase()] = s.value; return m; }, {});
const normalizeState = (v) => {
  const t = String(v || '').trim();
  if (!t) return '';
  if (t.length === 2) return t.toUpperCase();
  return STATE_ABBR[t.toLowerCase()] || t;
};
const stateName = (abbr) => { const hit = US_STATES.find((s) => s.value === abbr); return hit ? hit.label : abbr; };
const splitFirstMiddle = (first, middle) => {
  const f = String(first || '').trim(); const m = String(middle || '').trim();
  if (m || !/\s/.test(f)) return [f, m];
  const parts = f.split(/\s+/);
  return [parts[0], parts.slice(1).join(' ')];
};
const properCase = (s) => String(s || '').toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).trim();
// Mask a relative's name to first name + last initial (honest tease — same as the SUP).
const maskName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.map((w, i, a) => (i === a.length - 1 && a.length > 1 ? `${w[0]}.` : w)).join(' ');
};

const C = {
  pageBg: '#eef1f4', ink: '#111827', ink2: '#374151', mut: '#6b7280', line: '#e5e7eb',
  cardBg: '#fff', headerBg: 'linear-gradient(135deg, #0d5d2f 0%, #1a7a42 100%)',
  cta: '#f5a623', ctaInk: '#231a02', accent: '#0d5d2f',
};

const REPORT_SECTIONS = [
  ['🪪', 'Personal details', 'Full name, aliases, age & date of birth'],
  ['📷', 'Photos', 'Available photos on record'],
  ['📍', 'Location history', 'Current & past addresses'],
  ['👪', 'Relatives & associates', 'Family members and known associates'],
  ['🚔', 'Criminal & court records', 'Arrests, charges & court cases'],
  ['⚖️', 'Sex-offender registry', 'Registered-offender status & details'],
  ['📞', 'Contact info', 'Phone numbers & email addresses'],
];

// Real per-identity "also on file" chips — from the BC teaser counts (honest; absent categories drop out).
function foundChips(person) {
  const R = person.records || {}; const Fl = person.flags || {};
  const pl = (n, s, p) => `${n} ${n === 1 ? s : (p || s + 's')}`;
  const out = [];
  if (Fl.isCriminal || R.criminal > 0) out.push('⚖️ Criminal record');
  if (R.relatives > 0) out.push(`👥 ${pl(R.relatives, 'relative')}`);
  if (Fl.isPropertyOwner || R.property > 0) out.push(R.property > 0 ? `🏠 ${pl(R.property, 'property', 'properties')}` : '🏠 Property owner');
  if (Fl.hasEmployment || R.employment > 0) out.push('💼 Employment history');
  if (R.address > 0) out.push(`📍 ${pl(R.address, 'address', 'addresses')}`);
  if (R.phone > 0) out.push(`📞 ${pl(R.phone, 'number')}`);
  if (R.email > 0) out.push(`✉️ ${pl(R.email, 'email', 'emails')}`);
  if (Fl.hasVehicle) out.push('🚗 Vehicle record');
  return out;
}

export default function HomeFactsLandingV4Page() {
  const brand = useBrand();
  const navigate = useNavigate();
  const location = useLocation();
  useLandingTrack('name', CFG.variant);
  useFunnelFlow(CFG.flow);

  const lcParams = useMemo(() => {
    const m = {};
    for (const [k, v] of new URLSearchParams(location.search).entries()) { const lk = k.toLowerCase(); if (v && m[lk] === undefined) m[lk] = v; }
    return m;
  }, [location.search]);
  const qp = (...keys) => { for (const k of keys) { const v = lcParams[k.toLowerCase()]; if (v) return v; } return ''; };

  const [firstName, middleName] = splitFirstMiddle(qp('fn', 'firstname', 'first'), qp('mn', 'middlename', 'middle'));
  const lastName = qp('ln', 'lastname', 'last');
  const city = qp('city');
  const state = normalizeState(qp('state', 'st'));
  const age = qp('age');

  const [results, setResults] = useState([]);   // resolved BC identities (other matches)
  const [active, setActive] = useState(null);    // the chosen individual (BC person) or null (shell)
  const [loading, setLoading] = useState(false); // v4: starts FALSE — first paint is the shell, NO on-mount search/Turnstile
  const [error, setError] = useState('');

  const hasName = !!(firstName.trim() && lastName.trim());
  useEffect(() => { try { sessionStorage.setItem('idlPartnerBrand', CFG.partnerBrand); } catch { /* ignore */ } }, []);
  useEffect(() => { if (!hasName) navigate(`/name/landing/v3${location.search}`, { replace: true }); }, [hasName, navigate, location.search]);

  const fullName = properCase([firstName, lastName].filter(Boolean).join(' '));
  const initial = (fullName[0] || '?').toUpperCase();
  const locLabel = [properCase(city), state].filter(Boolean).join(', ');
  const subject = { firstName: firstName.trim(), lastName: lastName.trim(), state, city: city.trim(), age };

  // Persist a chosen individual so the canonical unlock→payment→report path finds it (result_<id> + selectedPersonId).
  const selectPerson = (p) => {
    try {
      sessionStorage.setItem(`result_${p.id}`, JSON.stringify(p));
      sessionStorage.setItem('selectedPersonId', p.id);
    } catch { /* ignore */ }
    // Canonical "profile shown" funnel event — v3 collapses SRP→SUP into this page, so without this the
    // funnel is blind to the profile view that IS happening (incident 2026-08-19).
    setSearchTarget(p);
    track('teaser_view', { personId: p.id, sup_variant: CFG.variant });
    gtmTeaserView({ identity_id: p.id, search_type: 'name' });
    setActive(p);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  // STEP 1 → 2: the tap runs the BC teaser search (the tap is the Turnstile gesture) and resolves the individual.
  const resolveProfile = useCallback(async () => {
    const f = firstName.trim(), l = lastName.trim(), m = middleName.trim(), c = city.trim();
    setLoading(true); setError('');
    gtmSetSearchInput({ firstName: f, lastName: l, middleName: m, city: c, state });
    saveDeclaredIdentity({ firstName: f, lastName: l, city: c, state });
    track('search_step', { step: 'resolve-profile', search_type: 'name', variant: CFG.variant });
    try {
      const params = { firstName: f, lastName: l };
      if (m) params.middleName = m;
      if (age) params.age = age;
      if (c) params.city = c;
      if (state) params.state = state;
      const response = await api.searchPeople(params);
      const list = (response.data || []).map((r) => ({ ...r, id: r.id || r.extId, extId: r.extId, fullName: r.fullName || fullName }));
      if (response.searchContext) setSearchContext(response.searchContext);
      try {
        sessionStorage.setItem('nameSearchResults', JSON.stringify({ results: list, query: { firstName: f, lastName: l, middleName: m, age, city: c, state }, searchContext: response.searchContext || {}, pagination: response.pagination || {}, flow: CFG.flow }));
      } catch { /* ignore */ }
      if (!list.length) { setError('no-match'); setLoading(false); return; }
      // Canonical funnel events — v3 collapses search→loader→results into one auto-resolve, so fire the
      // whole sequence here so the funnel sees "searched → saw results" (it was blind to v3 — incident 8/19).
      track('search_submit', { type: 'name', resultCount: list.length });
      track('loader_complete', { search_type: 'name', result_count: list.length });
      track('results_view', { search_type: 'name', query: `${f} ${l}`.trim(), state: state || '' });
      gtmSearchSubmit({ search_type: 'name', result_count: list.length, state: state || undefined });
      // Best guess: prefer a result whose location matches the city; else the top result.
      const cl = c.toLowerCase();
      const best = (cl && list.find((r) => (r.location || '').toLowerCase().includes(cl))) || list[0];
      setResults(list);
      selectPerson(best);
    } catch (err) {
      // Turnstile challenge failed / search errored — fall back to the tested loader flow so the visitor
      // still gets results (the loader owns its own captcha UX). Never a dead end.
      track('search_error', { variant: CFG.variant, reason: (err && err.message) || 'search_failed' });
      const p = new URLSearchParams();
      p.set('firstName', f); p.set('lastName', l);
      if (state) p.set('state', state); if (m) p.set('middleName', m); if (age) p.set('age', age); if (c) p.set('city', c);
      p.set('variant', CFG.variant);
      navigate(`/name/loader?${p.toString()}`);
      return;
    }
    setLoading(false);
  }, [firstName, lastName, middleName, city, state, age, fullName, navigate]);

  // v4: NO auto-resolve on mount. The first paint is the shell (identity + offender flag + report contents),
  // with NO BC search and therefore NO Turnstile challenge on arrival. resolveProfile() runs only on the CTA
  // tap below — the tap is the gesture that lets Turnstile pass cleanly. This is the whole point of v4.

  if (!hasName) return null;

  // Unlock → the EMAIL-ON-PAYMENT page (owner 2026-08-18: deprecate the create-account step). capture=email
  // collects just the email (required), auto-generates the password, and creates the account inline during
  // the sale. The chosen person is already stored (result_<id> + selectedPersonId) so /payment shows them.
  const unlock = () => {
    if (!active) return;
    // Canonical "profile selected" funnel event (the profile-click step) + the v3-specific step.
    track('serp_result_onboarding', { personId: active.id });
    track('search_step', { step: 'unlock-report', search_type: 'name', variant: CFG.variant });
    // reveal=1 → payment shows the person plainly (name search: identity already known, not the paywalled prize).
    navigate('/payment?capture=email&reveal=1');
  };

  const wrap = { maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 };
  const page = { background: C.pageBg, minHeight: '100vh', padding: 'clamp(16px,4vw,40px) 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' };

  // ── STEP 2: resolved individual profile (real BC data, custom layout) ──
  if (active) {
    const R = active.records || {};
    const rels = (active.relatives || []).filter((r) => r && r.name).slice(0, 6);
    const locs = (active.locations || []).filter(Boolean).slice(0, 6);
    const aliases = (active.aliases || []).filter(Boolean).slice(0, 4);
    const chips = foundChips(active);
    const others = results.filter((r) => r.id !== active.id).slice(0, 5);
    const pl = (n, s, p) => `${n} ${n === 1 ? s : (p || s + 's')}`;

    return (
      <main style={page} className="hf-v3-profile">
        {/* Mobile: pin the unlock CTA to the bottom; hide the inline one + pad the page so nothing hides under it. */}
        <style>{'.hf-mobile-cta{display:none}@media(max-width:640px){.hf-mobile-cta{display:block}.hf-inline-cta{display:none}.hf-v3-profile{padding-bottom:96px}}'}</style>
        <div style={wrap}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.mut, textAlign: 'center' }}>Continuing your search from HomeFacts</div>

          <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,24,29,.05),0 14px 40px rgba(20,24,29,.07)' }}>
            {/* Identity header — real avatar + name/age/location + aliases */}
            <div style={{ background: C.headerBg, color: '#fff', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <PersonAvatar person={active} size={60} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>{properCaseName(active.fullName)}{active.age || active.ageRange ? `, ${active.age || active.ageRange}` : ''}</div>
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{active.location || locLabel || 'Public records on file'}</div>
                {aliases.length > 0 && <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Also known as {aliases.map(properCase).join(', ')}</div>}
              </div>
            </div>

            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* First-party safety flag (offender — verify, not assert) */}
              <SignalTeaser subject={subject} flow="sexOffender" strict stage="pre-signup" accent={C.accent} />

              {/* Also on file — real chips from the BC teaser counts */}
              {chips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {chips.map((c) => (
                    <span key={c} style={{ fontSize: 12.5, fontWeight: 600, color: C.ink2, background: 'rgba(17,24,39,0.05)', borderRadius: 999, padding: '4px 10px' }}>{c}</span>
                  ))}
                </div>
              )}

              {/* Relatives — real names, masked (first + last initial) */}
              {rels.length > 0 && (
                <Section title={`Relatives & associates (${(R.relatives || rels.length)})`}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {rels.map((r, i) => (
                      <span key={i} style={{ fontSize: 13, color: C.ink2, background: '#f3f4f6', borderRadius: 8, padding: '5px 10px' }}>
                        {maskName(r.name)}{r.relation ? ` · ${r.relation}` : ''}
                      </span>
                    ))}
                    <span style={{ fontSize: 12.5, color: C.mut, alignSelf: 'center' }}>🔒 unlock for full names</span>
                  </div>
                </Section>
              )}

              {/* Location history — real cities/states from the record */}
              {locs.length > 0 && (
                <Section title="Location history">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {locs.map((loc, i) => (
                      <div key={i} style={{ fontSize: 13, color: C.ink2 }}>📍 {typeof loc === 'string' ? loc : [loc.city, loc.state].filter(Boolean).join(', ')} <span style={{ color: C.mut, filter: 'blur(3px)' }}>· street ████</span></div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Contact — honest masked counts */}
              {(R.phone > 0 || R.email > 0 || R.address > 0) && (
                <Section title="Contact & addresses">
                  <div style={{ fontSize: 13, color: C.ink2, lineHeight: 1.7 }}>
                    {R.phone > 0 && <div>📞 {pl(R.phone, 'number')} on file · (•••) •••-••••</div>}
                    {R.email > 0 && <div>✉️ {pl(R.email, 'email', 'emails')} on file · ••••@••••</div>}
                    {R.address > 0 && <div>📍 {pl(R.address, 'address', 'addresses')} on record</div>}
                  </div>
                </Section>
              )}

              <button type="button" onClick={unlock} className="hf-inline-cta"
                style={{ background: C.cta, color: C.ctaInk, border: 'none', borderRadius: 10, padding: '15px 22px', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                Unlock {properCaseName(active.fullName).split(' ')[0]}'s full report →
              </button>

              {/* Mobile: the same unlock CTA anchored to the bottom of the screen (owner 2026-08-18). */}
              <div className="hf-mobile-cta" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: `1px solid ${C.line}`, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 16px rgba(0,0,0,0.10)', zIndex: 50 }}>
                <button type="button" onClick={unlock}
                  style={{ width: '100%', background: C.cta, color: C.ctaInk, border: 'none', borderRadius: 10, padding: '15px 22px', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                  Unlock {properCaseName(active.fullName).split(' ')[0]}'s full report →
                </button>
              </div>

            </div>
          </div>

          {/* Other matches — a SEPARATE card below the profile so it's clearly divided from THIS person's
              own data. Matters on mobile: the pinned CTA removed the old inline break, so without its own
              card the matches ran straight into the profile. */}
          {others.length > 0 && (
            <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 16, padding: '16px 20px', boxShadow: '0 1px 2px rgba(20,24,29,.05),0 6px 20px rgba(20,24,29,.05)' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>Not the {fullName} you're looking for?</div>
              <div style={{ fontSize: 12, color: C.mut, margin: '2px 0 12px' }}>Other people named {fullName}:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {others.map((p) => (
                  <button key={p.id} type="button" onClick={() => selectPerson(p)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
                    <PersonAvatar person={p} size={34} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{properCaseName(p.fullName)}{p.age || p.ageRange ? `, ${p.age || p.ageRange}` : ''}</div>
                      <div style={{ fontSize: 12, color: C.mut }}>{p.location || 'View profile'}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 13, color: C.accent, fontWeight: 700 }}>View →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: 11, color: '#9aa4ad', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
            {brand.name} is not a consumer reporting agency under the FCRA. Do not use this information for
            employment, tenant, or credit screening. Offender and criminal records are shown from licensed
            sources and require your agreement to responsible use before viewing.
          </p>
        </div>
      </main>
    );
  }

  // ── LOADING: resolving after the CTA tap (identity known from the URL; real data on the way) ──
  if (loading) {
    return (
      <main style={page}>
        <style>{'@keyframes hfspin{to{transform:rotate(360deg)}}'}</style>
        <div style={wrap}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.mut, textAlign: 'center' }}>Continuing your search from HomeFacts</div>
          <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,24,29,.05),0 14px 40px rgba(20,24,29,.07)' }}>
            <div style={{ background: C.headerBg, color: '#fff', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flex: '0 0 auto' }}>{initial}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>{fullName}</div>
                <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{locLabel || 'Public records'}</div>
              </div>
            </div>
            <div style={{ padding: '34px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', border: `3px solid ${C.line}`, borderTopColor: C.accent, animation: 'hfspin .8s linear infinite' }} aria-hidden="true" />
              <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, textAlign: 'center' }}>Finding {fullName}'s full profile…</div>
              <div style={{ fontSize: 12.5, color: C.mut, textAlign: 'center', lineHeight: 1.5 }}>Searching public records{state ? ` across ${stateName(state)}` : ''} — records, relatives &amp; addresses. This takes a few seconds.</div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: '#9aa4ad', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
            {brand.name} is not a consumer reporting agency under the FCRA. Do not use this information for
            employment, tenant, or credit screening.
          </p>
        </div>
      </main>
    );
  }

  // ── STEP 1: the SHELL — v4's primary first paint (instant, no search, no Turnstile). Tap resolves. ──
  return (
    <main style={page}>
      <div style={wrap}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.mut, textAlign: 'center' }}>Continuing your search from HomeFacts</div>

        <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,24,29,.05),0 14px 40px rgba(20,24,29,.07)' }}>
          <div style={{ background: C.headerBg, color: '#fff', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flex: '0 0 auto' }}>{initial}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>{fullName}</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{[locLabel, age ? `Age ${age}` : null].filter(Boolean).join(' · ') || 'Public records on file'}</div>
            </div>
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>Is this the {fullName} you're looking for?</div>
            <SignalTeaser subject={subject} flow="sexOffender" strict stage="pre-signup" accent={C.accent} />

            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.mut, margin: '0 0 8px' }}>{fullName}'s full profile includes</div>
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
                {REPORT_SECTIONS.map(([icon, label, sub], i) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                    <span style={{ fontSize: 17, flex: '0 0 auto' }} aria-hidden="true">{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{label}</div>
                      <div style={{ fontSize: 12, color: C.mut }}>{sub}</div>
                    </div>
                    <span style={{ fontSize: 12.5, color: C.mut, flex: '0 0 auto' }} aria-hidden="true">🔒</span>
                  </div>
                ))}
              </div>
            </div>

            {error === 'no-match' && (
              <div style={{ fontSize: 13, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px' }}>
                We couldn't find an exact match for {fullName}{state ? ` in ${stateName(state)}` : ''}. Try a broader search.
              </div>
            )}

            <button type="button" onClick={resolveProfile} disabled={loading}
              style={{ background: C.cta, color: C.ctaInk, border: 'none', borderRadius: 10, padding: '15px 22px', fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? `Finding ${fullName}…` : `See ${fullName}'s full profile →`}
            </button>
          </div>
        </div>

        <p style={{ fontSize: 11, color: '#9aa4ad', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
          {brand.name} is not a consumer reporting agency under the FCRA. Do not use this information for
          employment, tenant, or credit screening. Offender and criminal records are shown from licensed
          sources and require your agreement to responsible use before viewing.
        </p>
      </div>
    </main>
  );
}

// Small labeled profile section.
function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 7px' }}>{title}</div>
      {children}
    </div>
  );
}
