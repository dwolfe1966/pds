import React, { useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBrand } from '../../services/brand';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useFunnelFlow } from '../../services/funnelFlow';
import { track } from '../../services/trackingService';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import { saveDeclaredIdentity } from '../../services/identityProfile';
import SignalTeaser from '../../components/SignalTeaser';
import { US_STATES } from '../../data/usStates';

/**
 * HomeFacts landing v3 — PROFILE-FIRST (owner 2026-08-18).
 *
 * HomeFacts visitors arrive having just viewed a SINGLE sex-offender profile, so dropping them on a search
 * FORM or a results LIST breaks continuity (cognitive dissonance). v3 instead meets them with our best-guess
 * PROFILE — shaped like a resolved result (our SUP), with an "other people named X" switcher. This mirrors
 * how Intelius onboards HomeFacts traffic: a page that looks like a profile but is the top of the funnel.
 *
 * CAPTCHA-SAFE BY DESIGN: everything pre-click is FIRST-PARTY (SignalTeaser → getPersonSignals → our own
 * idlookup.me record endpoints — NO BC, NO Turnstile). The unlock CLICK is the human gesture that lets the
 * downstream BC search pass Turnstile; it hands off to the existing, tested /name/loader flow (variant
 * 'homefacts-v3'). Nothing gated runs until the user acts. (This is the v1 handoff; a "resolve-at-unlock"
 * step that skips the results list entirely is the planned v3.1.)
 *
 * COMPLIANCE: the offender element is a POSSIBLE-match FLAG framed to verify, never an assertion — that
 * framing lives in SignalTeaser (CAPABILITY_COPY.sexOffender, amber warning box). Corroborated offender/
 * criminal records reveal POST-PAY from our licensed source; FCRA agreement is enforced at /payment.
 */

// Config (isolated — distinct variant keeps metrics separate, like v2).
const CFG = { variant: 'homefacts-v3', flow: 'sexOffender', partnerBrand: 'homefacts' };

const STATE_ABBR = US_STATES.reduce((m, s) => { if (s.value) m[s.label.toLowerCase()] = s.value; return m; }, {});
const normalizeState = (v) => {
  const t = String(v || '').trim();
  if (!t) return '';
  if (t.length === 2) return t.toUpperCase();
  return STATE_ABBR[t.toLowerCase()] || t;
};
const stateName = (abbr) => {
  const hit = US_STATES.find((s) => s.value === abbr);
  return hit ? hit.label : abbr;
};
const splitFirstMiddle = (first, middle) => {
  const f = String(first || '').trim(); const m = String(middle || '').trim();
  if (m || !/\s/.test(f)) return [f, m];
  const parts = f.split(/\s+/);
  return [parts[0], parts.slice(1).join(' ')];
};
const properCase = (s) => String(s || '').toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).trim();

// SUP-like palette (professional, safety-leaning).
const C = {
  pageBg: '#eef1f4', ink: '#111827', mut: '#6b7280', line: '#e5e7eb',
  cardBg: '#fff', headerBg: 'linear-gradient(135deg, #0d5d2f 0%, #1a7a42 100%)',
  cta: '#f5a623', ctaInk: '#231a02', accent: '#0d5d2f',
};

const TEASED_ROWS = [
  ['📍', 'Address history', 'Current & past addresses'],
  ['👪', 'Relatives & associates', 'Family and known associates'],
  ['🚔', 'Criminal & court records', 'Arrests, charges, case records'],
  ['📞', 'Contact info', 'Phone numbers & email addresses'],
];

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

  // No name to profile → fall through to the general funnel, preserving the query string + co-brand.
  const hasName = !!(firstName.trim() && lastName.trim());
  useEffect(() => {
    try { sessionStorage.setItem('idlPartnerBrand', CFG.partnerBrand); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!hasName) navigate(`/name/landing/v3${location.search}`, { replace: true });
  }, [hasName, navigate, location.search]);
  if (!hasName) return null;

  const fullName = properCase([firstName, lastName].filter(Boolean).join(' '));
  const initial = (fullName[0] || '?').toUpperCase();
  const locLabel = [properCase(city), state].filter(Boolean).join(', ');
  const subject = { firstName: firstName.trim(), lastName: lastName.trim(), state, city: city.trim(), age };

  // Unlock / browse handoff — the CLICK supplies the Turnstile gesture; reuse the existing /name/loader flow.
  const goToReport = (browse) => {
    const f = firstName.trim(), l = lastName.trim(), m = middleName.trim(), c = city.trim();
    gtmSetSearchInput({ firstName: f, lastName: l, middleName: m, city: c, state });
    saveDeclaredIdentity({ firstName: f, lastName: l, city: c, state }); // durable first-party identity
    track('search_step', { step: browse ? 'browse-others' : 'unlock-profile', search_type: 'name', variant: CFG.variant });
    try { sessionStorage.removeItem('nameSearchResults'); } catch { /* ignore */ }
    const p = new URLSearchParams();
    p.set('firstName', f);
    p.set('lastName', l);
    if (state) p.set('state', state);
    if (m) p.set('middleName', m);
    if (age) p.set('age', age);
    if (c && !browse) p.set('city', c); // browse widens to state; unlock keeps city for the tightest match
    p.set('variant', CFG.variant);
    navigate(`/name/loader?${p.toString()}`);
  };

  return (
    <main style={{ background: C.pageBg, minHeight: '100vh', padding: 'clamp(16px,4vw,40px) 16px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Co-brand ribbon */}
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.mut, textAlign: 'center' }}>
          Continuing your search from HomeFacts
        </div>

        {/* Profile card (SUP-styled) */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 2px rgba(20,24,29,.05),0 14px 40px rgba(20,24,29,.07)' }}>
          {/* Identity header band */}
          <div style={{ background: C.headerBg, color: '#fff', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, flex: '0 0 auto' }}>{initial}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15 }}>{fullName}</div>
              <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>
                {[locLabel, age ? `Age ${age}` : null].filter(Boolean).join(' · ') || 'Public records on file'}
              </div>
            </div>
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: C.ink }}>Is this the {fullName} you're looking for?</div>

            {/* First-party safety teaser — the amber "possible offender record — verify" flag + any real
                first-party records. NO Turnstile: this runs off getPersonSignals (our own endpoints). */}
            <SignalTeaser subject={subject} flow="sexOffender" strict stage="pre-signup" accent={C.accent} />

            {/* Teased/locked sections — what the full report unlocks. */}
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
              {TEASED_ROWS.map(([icon, label, sub], i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                  <span style={{ fontSize: 17, flex: '0 0 auto' }} aria-hidden="true">{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.ink }}>{label}</div>
                    <div style={{ fontSize: 12, color: C.mut, filter: 'blur(3px)', userSelect: 'none' }} aria-hidden="true">{sub}</div>
                  </div>
                  <span style={{ fontSize: 13, color: C.mut, flex: '0 0 auto' }} aria-hidden="true">🔒</span>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => goToReport(false)}
              style={{ background: C.cta, color: C.ctaInk, border: 'none', borderRadius: 10, padding: '15px 22px', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
              See {fullName}'s full report →
            </button>

            {/* "Other people like this one" — browse other matches for the same name in the state. */}
            <button type="button" onClick={() => goToReport(true)}
              style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>
              Not the right {fullName}? See other people named {properCase(firstName)} {properCase(lastName)}{state ? ` in ${stateName(state)}` : ''} →
            </button>
          </div>
        </div>

        {/* Compliance / reassurance */}
        <p style={{ fontSize: 11, color: '#9aa4ad', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
          {brand.name} is not a consumer reporting agency under the FCRA. Do not use this information for
          employment, tenant, or credit screening. Offender and criminal records are shown from licensed
          sources and require your agreement to responsible use before viewing.
        </p>
      </div>
    </main>
  );
}
