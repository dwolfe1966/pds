import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';
import { useBrand } from '../../services/brand';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useFunnelFlow } from '../../services/funnelFlow';
import { track } from '../../services/trackingService';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { saveDeclaredIdentity } from '../../services/identityProfile';
import SignalTeaser from '../../components/SignalTeaser';
import { PersonAvatar, properCaseName } from '../../components/PersonAvatar';
import { US_STATES } from '../../data/usStates';

/**
 * HomeFacts landing v3 — PROFILE-FIRST with REAL data (owner 2026-08-18).
 *
 * HomeFacts visitors arrive from a single sex-offender profile, so we meet them with an individual PROFILE,
 * not a search form/list. Two steps:
 *   1. SHELL (instant, captcha-safe, first-party): identity + the compliant "possible offender record —
 *      verify" flag (SignalTeaser) + what the report contains. A single tap "See {name}'s full profile".
 *   2. RESOLVED PROFILE: the tap runs the BC teaser search — the tap is the human GESTURE that lets Turnstile
 *      pass (the proven v2 fix; "turnstile on the first step", owner) — we pick the best-matching individual
 *      and render their REAL data (aliases, relatives, address/record counts, locations) in a CUSTOM v3
 *      layout (not the SUP verbatim). "Other people named X" switches which individual is shown. Unlock →
 *      the canonical signup → payment → report path (the resolved person carries the BC extId).
 *
 * COMPLIANCE: the offender element is a POSSIBLE-match flag framed to verify (SignalTeaser), never asserted;
 * corroborated offender/criminal records reveal POST-PAY from our licensed source; FCRA agreement at /payment.
 */

const CFG = { variant: 'homefacts-v3', flow: 'sexOffender', partnerBrand: 'homefacts' };

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

export default function HomeFactsLandingV3Page() {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasName = !!(firstName.trim() && lastName.trim());
  useEffect(() => { try { sessionStorage.setItem('idlPartnerBrand', CFG.partnerBrand); } catch { /* ignore */ } }, []);
  useEffect(() => { if (!hasName) navigate(`/name/landing/v3${location.search}`, { replace: true }); }, [hasName, navigate, location.search]);
  if (!hasName) return null;

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

  // Unlock a resolved individual → canonical signup → payment → report (person carries the BC extId).
  const unlock = () => {
    if (!active) return;
    track('search_step', { step: 'unlock-report', search_type: 'name', variant: CFG.variant });
    navigate(`/name/signup?selected=${encodeURIComponent(active.id)}`);
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
      <main style={page}>
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

              <button type="button" onClick={unlock}
                style={{ background: C.cta, color: C.ctaInk, border: 'none', borderRadius: 10, padding: '15px 22px', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
                Unlock {properCaseName(active.fullName).split(' ')[0]}'s full report →
              </button>

              {/* Other matches — switch which individual is shown */}
              {others.length > 0 && (
                <Section title={`Other people named ${fullName}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {others.map((p) => (
                      <button key={p.id} type="button" onClick={() => selectPerson(p)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: `1px solid ${C.line}`, borderRadius: 10, padding: '9px 12px', cursor: 'pointer', textAlign: 'left' }}>
                        <PersonAvatar person={p} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{properCaseName(p.fullName)}{p.age || p.ageRange ? `, ${p.age || p.ageRange}` : ''}</div>
                          <div style={{ fontSize: 12, color: C.mut }}>{p.location || 'View profile'}</div>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: 13, color: C.accent, fontWeight: 700 }}>View →</span>
                      </button>
                    ))}
                  </div>
                </Section>
              )}
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

  // ── STEP 1: shell (instant, first-party, captcha-safe) ──
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
