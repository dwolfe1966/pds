// Shared foundation for the HomeFacts entry-experience A/B set (v5, v6, …). Owner 2026-08-21:
// build every permutation as its own route, review, then choose a rotation. These pages differ in
// LAYOUT/framing/timing; the identity parsing, BC resolve, unlock→payment, and UI blocks are shared
// here so each page stays thin and the arms stay consistent. Design doc: docs/homefacts/entry-experience-permutations.md
//
// Two resolve flows (a page picks one):
//   • TWO-STEP  (shell → "see profile" resolves → resolved view → "unlock" → payment)  — reuses v4's pattern.
//   • ONE-STEP  (shell → "unlock" resolves on the tap, then goes straight to /payment)  — no search on the
//     landing at all, so Turnstile only appears at high intent (the unlock), never on arrival.
import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';
import { track } from '../../services/trackingService';
import { setSearchInput as gtmSetSearchInput, setSearchTarget } from '../../services/gtmContext';
import { gtmSearchSubmit, gtmTeaserView } from '../../services/gtm';
import { saveDeclaredIdentity } from '../../services/identityProfile';
import SignalTeaser from '../../components/SignalTeaser';
import { PersonAvatar, properCaseName } from '../../components/PersonAvatar';
import { US_STATES } from '../../data/usStates';

// ── palette + helpers ───────────────────────────────────────────────────────
export const C = {
  pageBg: '#eef1f4', ink: '#111827', ink2: '#374151', mut: '#6b7280', line: '#e5e7eb',
  cardBg: '#fff', headerBg: 'linear-gradient(135deg, #0d5d2f 0%, #1a7a42 100%)',
  cta: '#f5a623', ctaInk: '#231a02', accent: '#0d5d2f', amber: '#a9781f', amberSoft: '#fffbeb', amberLine: '#fde68a',
};

const STATE_ABBR = US_STATES.reduce((m, s) => { if (s.value) m[s.label.toLowerCase()] = s.value; return m; }, {});
export const normalizeState = (v) => {
  const t = String(v || '').trim();
  if (!t) return '';
  if (t.length === 2) return t.toUpperCase();
  return STATE_ABBR[t.toLowerCase()] || t;
};
export const stateName = (abbr) => { const hit = US_STATES.find((s) => s.value === abbr); return hit ? hit.label : abbr; };
export const properCase = (s) => String(s || '').toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).trim();
export const pl = (n, s, p) => `${n} ${n === 1 ? s : (p || s + 's')}`;
const splitFirstMiddle = (first, middle) => {
  const f = String(first || '').trim(); const m = String(middle || '').trim();
  if (m || !/\s/.test(f)) return [f, m];
  const parts = f.split(/\s+/);
  return [parts[0], parts.slice(1).join(' ')];
};
export const maskName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return parts.map((w, i, a) => (i === a.length - 1 && a.length > 1 ? `${w[0]}.` : w)).join(' ');
};

export const REPORT_SECTIONS = [
  ['🪪', 'Personal details', 'Full name, aliases, age & date of birth'],
  ['📷', 'Photos', 'Available photos on record'],
  ['📍', 'Location history', 'Current & past addresses'],
  ['👪', 'Relatives & associates', 'Family members and known associates'],
  ['🚔', 'Criminal & court records', 'Arrests, charges & court cases'],
  ['⚖️', 'Sex-offender registry', 'Registered-offender status & details'],
  ['📞', 'Contact info', 'Phone numbers & email addresses'],
];

// Real "also on file" chips from the BC teaser counts (honest; absent categories drop out).
export function foundChips(person) {
  const R = (person && person.records) || {}; const Fl = (person && person.flags) || {};
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

// ── subject from the URL params ──────────────────────────────────────────────
export function useHomeFactsSubject() {
  const location = useLocation();
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

  const hasName = !!(firstName.trim() && lastName.trim());
  const fullName = properCase([firstName, lastName].filter(Boolean).join(' '));
  const firstOnly = properCase(firstName);
  const initial = (fullName[0] || '?').toUpperCase();
  const locLabel = [properCase(city), state].filter(Boolean).join(', ');
  const subject = { firstName: firstName.trim(), lastName: lastName.trim(), state, city: city.trim(), age };
  return { firstName, middleName, lastName, city, state, age, hasName, fullName, firstOnly, initial, locLabel, subject, search: location.search };
}

// Cold arrivals with no name → the generic cold-search landing (HomeFacts always sends a name).
export function useRequireName(hasName, search) {
  const navigate = useNavigate();
  useEffect(() => { if (!hasName) navigate(`/name/landing/v3${search}`, { replace: true }); }, [hasName, navigate, search]);
}

// ── resolve + unlock (shared BC teaser search) ───────────────────────────────
export function useHomeFactsResolve({ firstName, middleName, lastName, city, state, age, fullName, variant, flow, partnerBrand, autoFire = false }) {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(!!autoFire);
  const [error, setError] = useState('');

  useEffect(() => { try { sessionStorage.setItem('idlPartnerBrand', partnerBrand); } catch { /* ignore */ } }, [partnerBrand]);

  const storePerson = (p) => {
    try {
      sessionStorage.setItem(`result_${p.id}`, JSON.stringify(p));
      sessionStorage.setItem('selectedPersonId', p.id);
    } catch { /* ignore */ }
    setSearchTarget(p);
  };

  const selectPerson = (p) => {
    storePerson(p);
    track('teaser_view', { personId: p.id, sup_variant: variant });
    gtmTeaserView({ identity_id: p.id, search_type: 'name' });
    setActive(p);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };

  // The BC teaser search (the tap is the Turnstile gesture). Returns { list, best } or throws.
  const runSearch = useCallback(async () => {
    const f = firstName.trim(), l = lastName.trim(), m = (middleName || '').trim(), c = (city || '').trim();
    gtmSetSearchInput({ firstName: f, lastName: l, middleName: m, city: c, state });
    saveDeclaredIdentity({ firstName: f, lastName: l, city: c, state });
    track('search_step', { step: 'resolve-profile', search_type: 'name', variant });
    const params = { firstName: f, lastName: l };
    if (m) params.middleName = m;
    if (age) params.age = age;
    if (c) params.city = c;
    if (state) params.state = state;
    const response = await api.searchPeople(params);
    const list = (response.data || []).map((r) => ({ ...r, id: r.id || r.extId, extId: r.extId, fullName: r.fullName || fullName }));
    if (response.searchContext) setSearchContext(response.searchContext);
    try {
      sessionStorage.setItem('nameSearchResults', JSON.stringify({ results: list, query: { firstName: f, lastName: l, middleName: m, age, city: c, state }, searchContext: response.searchContext || {}, pagination: response.pagination || {}, flow }));
    } catch { /* ignore */ }
    if (list.length) {
      track('search_submit', { type: 'name', resultCount: list.length });
      track('loader_complete', { search_type: 'name', result_count: list.length });
      track('results_view', { search_type: 'name', query: `${f} ${l}`.trim(), state: state || '' });
      gtmSearchSubmit({ search_type: 'name', result_count: list.length, state: state || undefined });
    }
    const cl = c.toLowerCase();
    const best = (cl && list.find((r) => (r.location || '').toLowerCase().includes(cl))) || list[0] || null;
    return { list, best };
  }, [firstName, lastName, middleName, city, state, age, fullName, variant, flow]);

  // On search error, fall back to the tested loader flow (never a dead end).
  const toLoaderFallback = useCallback((err) => {
    track('search_error', { variant, reason: (err && err.message) || 'search_failed' });
    const p = new URLSearchParams();
    p.set('firstName', firstName.trim()); p.set('lastName', lastName.trim());
    if (state) p.set('state', state); if ((middleName || '').trim()) p.set('middleName', middleName.trim());
    if (age) p.set('age', age); if ((city || '').trim()) p.set('city', city.trim());
    p.set('variant', variant);
    navigate(`/name/loader?${p.toString()}`);
  }, [firstName, lastName, middleName, city, state, age, variant, navigate]);

  // TWO-STEP: resolve and render the resolved profile in-page.
  const resolveProfile = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { list, best } = await runSearch();
      if (!list.length || !best) { setError('no-match'); setLoading(false); return; }
      setResults(list);
      selectPerson(best);
    } catch (err) { toLoaderFallback(err); return; }
    setLoading(false);
  }, [runSearch, toLoaderFallback]); // eslint-disable-line react-hooks/exhaustive-deps

  // ONE-STEP: resolve on the unlock tap, then go straight to email-on-payment.
  const resolveAndPay = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { best } = await runSearch();
      if (!best) { setError('no-match'); setLoading(false); return; }
      storePerson(best);
      track('serp_result_onboarding', { personId: best.id, variant });
      navigate('/payment?capture=email&reveal=1');
    } catch (err) { toLoaderFallback(err); }
  }, [runSearch, toLoaderFallback, navigate, variant]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unlock from an already-resolved profile (two-step).
  const unlock = useCallback(() => {
    if (!active) return;
    track('serp_result_onboarding', { personId: active.id });
    track('search_step', { step: 'unlock-report', search_type: 'name', variant });
    navigate('/payment?capture=email&reveal=1');
  }, [active, navigate, variant]);

  const firedRef = useRef(false);
  useEffect(() => {
    if (autoFire && !firedRef.current && firstName.trim() && lastName.trim()) { firedRef.current = true; resolveProfile(); }
  }, [autoFire, firstName, lastName, resolveProfile]);

  return { results, active, loading, error, resolveProfile, resolveAndPay, selectPerson, unlock, setActive };
}

// ── reusable UI blocks ───────────────────────────────────────────────────────
export const page = { background: C.pageBg, minHeight: '100vh', padding: 'clamp(16px,4vw,40px) 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' };
export const wrap = { maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 };
export const card = { background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,24,29,.05),0 14px 40px rgba(20,24,29,.07)' };
export const ctaBtn = { background: C.cta, color: C.ctaInk, border: 'none', borderRadius: 10, padding: '15px 22px', fontSize: 16, fontWeight: 800, cursor: 'pointer' };

export function Continuity() {
  return <div style={{ fontSize: 12.5, fontWeight: 700, color: C.mut, textAlign: 'center' }}>Continuing your search from HomeFacts</div>;
}

export function IdentityHeader({ person, fullName, initial, sub }) {
  return (
    <div style={{ background: C.headerBg, color: '#fff', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
      {person
        ? <PersonAvatar person={person} size={60} />
        : <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flex: '0 0 auto' }}>{initial}</div>}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>{person ? `${properCaseName(person.fullName)}${person.age || person.ageRange ? `, ${person.age || person.ageRange}` : ''}` : fullName}</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{sub || (person && person.location) || 'Public records on file'}</div>
      </div>
    </div>
  );
}

export function OffenderFlag({ subject }) {
  return <SignalTeaser subject={subject} flow="sexOffender" strict stage="pre-signup" accent={C.accent} />;
}

// Real booking signal (first-party incarceration) — leads with the actual record: mugshot + facility name +
// charges when we have a match; renders NOTHING otherwise (safe-by-default). This is the SPECIFIC offender
// treatment that replaces the generic box — it only earns its space when it has something real to show.
// `flow="inmate"` leads booking and is not a capability flow, so no hollow teaser when the record is empty.
export function BookingSignal({ subject }) {
  return <SignalTeaser subject={subject} flow="inmate" stage="pre-signup" accent={C.accent} />;
}

export function CountChips({ person }) {
  const chips = foundChips(person);
  if (!chips.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {chips.map((c) => <span key={c} style={{ fontSize: 12.5, fontWeight: 600, color: C.ink2, background: 'rgba(17,24,39,0.05)', borderRadius: 999, padding: '4px 10px' }}>{c}</span>)}
    </div>
  );
}

export function ReportIncludes({ fullName, rows = REPORT_SECTIONS }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: C.mut, margin: '0 0 8px' }}>{fullName}'s full record includes</div>
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
        {rows.map(([icon, label, sub], i) => (
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
  );
}

// Inline CTA + always-visible mobile bottom bar. `scopeClass` isolates the media query per page.
export function UnlockCta({ label, onClick, loading, scopeClass }) {
  return (
    <>
      <style>{`.${scopeClass}-mcta{display:none}@media(max-width:640px){.${scopeClass}-mcta{display:block}.${scopeClass}-icta{display:none}.${scopeClass}{padding-bottom:96px}}`}</style>
      <button type="button" onClick={onClick} disabled={loading} className={`${scopeClass}-icta`} style={{ ...ctaBtn, opacity: loading ? 0.7 : 1 }}>{label}</button>
      <div className={`${scopeClass}-mcta`} style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: '#fff', borderTop: `1px solid ${C.line}`, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', boxShadow: '0 -4px 16px rgba(0,0,0,0.10)', zIndex: 50 }}>
        <button type="button" onClick={onClick} disabled={loading} style={{ ...ctaBtn, width: '100%', opacity: loading ? 0.7 : 1 }}>{label}</button>
      </div>
    </>
  );
}

export function Disclaimer({ brandName }) {
  return (
    <p style={{ fontSize: 11, color: '#9aa4ad', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
      {brandName} is not a consumer reporting agency under the FCRA. Do not use this information for
      employment, tenant, or credit screening. Offender and criminal records are shown from licensed
      sources and require your agreement to responsible use before viewing.
    </p>
  );
}

// Loader shown after the tap (identity known; real data on the way).
export function ResolveLoader({ fullName, initial, state }) {
  return (
    <div style={card}>
      <style>{'@keyframes hfspin{to{transform:rotate(360deg)}}'}</style>
      <IdentityHeader fullName={fullName} initial={initial} />
      <div style={{ padding: '34px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', border: `3px solid ${C.line}`, borderTopColor: C.accent, animation: 'hfspin .8s linear infinite' }} aria-hidden="true" />
        <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, textAlign: 'center' }}>Finding {fullName}'s record…</div>
        <div style={{ fontSize: 12.5, color: C.mut, textAlign: 'center', lineHeight: 1.5 }}>Searching public records{state ? ` across ${stateName(state)}` : ''} — records, relatives &amp; addresses.</div>
      </div>
    </div>
  );
}

// Small labeled section.
export function Section({ title, children }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: '#6b7280', margin: '0 0 7px' }}>{title}</div>
      {children}
    </div>
  );
}
