import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getMappedIdentity, fetchMappedIdentity, computeExposure,
  updateMappedIdentity, saveMemberProfile, enrichViaPersonSearch,
} from '../services/memberEnrichment';
import { syncBreach } from '../services/identityMonitorService';

/**
 * FreeExposureHero — the free-tier's center of gravity (owner 2026-08-15).
 *
 * Free tier = "Exposure" (the problem); paid = "Protection" (the solution). Free members land on the
 * dashboard and see how EXPOSED they are, then get one clean push to subscribe. This is the consolidated
 * free hero — it REUSES the existing exposure calc (computeExposure) + breach service (syncBreach); it
 * does not introduce a new score.
 *
 * TEASER, NOT A WALL (owner 2026-08-15): the free tier does NOT mask everything — it EXPOSES much as a
 * teaser. We show the real per-category exposure details in the clear (city/state, address-history count,
 * relative count, employer, breach count + data-classes) — that's the anxiety. What paid unlocks is the
 * ITEMIZED specifics (the actual addresses, relative names, breach sites) AND the power to HIDE them.
 *
 * The free tier needs PII to have value (owner): with no claimed identity we can't score anything, so when
 * unclaimed the hero's job is to CAPTURE the identity (name + city + state). City matters — the scary
 * drivers (relatives / address history via enrichViaPersonSearch) refuse without it, and a name+state-only
 * record scores "Low", killing the anxiety. The signup EMAIL gives us HIBP breaches for free — the one
 * strong driver every fresh account has.
 */

const ORANGE = '#f5a623';
const scoreColor = (s) => (s >= 65 ? '#dc2626' : s >= 35 ? '#f59e0b' : '#0d5d2f');

const card = {
  border: '1px solid #d7ddd9', borderRadius: 14, padding: '18px 22px', background: '#fff',
  boxShadow: '0 2px 10px rgba(17,24,39,0.06)', display: 'flex', flexDirection: 'column', gap: 14,
};
const eyebrow = { fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' };
const primaryCta = {
  alignSelf: 'flex-start', background: ORANGE, color: '#231a02', border: 'none', borderRadius: 8,
  padding: '11px 20px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
};
const toggleBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
  background: 'none', border: 'none', borderTop: '1px solid #f0f1f3', padding: '11px 0 0',
  fontSize: 13, fontWeight: 700, color: GREEN, cursor: 'pointer',
};

function Bar({ score, color }) {
  return (
    <div style={{ height: 10, background: '#eef2f0', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.max(4, score)}%`, background: color, transition: 'width .5s ease' }} />
    </div>
  );
}

// One exposed category, shown IN THE CLEAR as a teaser (real detail). Paid unlocks the itemized specifics
// + the ability to hide it — so the value line is "see the exact items & remove them", not "unblur".
function ExposureRow({ label, detail }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: '1px solid #f0f1f3', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, marginTop: 2, flex: '0 0 auto' }} aria-hidden="true">⚠️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{label}</div>
        <div style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.45 }}>{detail}</div>
      </div>
      <span style={{
        fontSize: 10.5, fontWeight: 800, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca',
        borderRadius: 999, padding: '2px 8px', flex: '0 0 auto', textTransform: 'uppercase', letterSpacing: '0.04em',
      }}>
        Exposed
      </span>
    </div>
  );
}

export default function FreeExposureHero() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [identity, setIdentity] = useState(() => getMappedIdentity());
  const [breach, setBreach] = useState(null);
  // Collapsed by default (owner 2026-08-15): the hero sits in the dashboard grid next to the WSFY count,
  // so it shows only the score + summary line and folds the category detail behind a toggle — it shouldn't
  // take over the dashboard. Expanded state persists so a member who opens it keeps it open.
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('exposureHeroExpanded') === '1'; } catch { return false; }
  });
  const toggle = () => setExpanded((v) => {
    const n = !v;
    try { localStorage.setItem('exposureHeroExpanded', n ? '1' : '0'); } catch { /* ignore */ }
    return n;
  });

  // Pull the server-side mapped identity + HIBP breaches (breach = the scary driver a fresh account has).
  useEffect(() => {
    let alive = true;
    fetchMappedIdentity().then((i) => { if (alive && i) setIdentity(i); });
    const email = user && user.email;
    if (email) {
      syncBreach(email).then((r) => {
        if (alive && r && r.available && r.exposure) setBreach(r.exposure);
      }).catch(() => {});
    }
    return () => { alive = false; };
  }, [user && user.email]);

  // Once we have a claimed identity — including one BRIDGED from the anonymous self-door (MyExposurePage) —
  // enrich relatives / address-history from PersonSearch so the scary drivers populate. Self-guards to once
  // per member and no-ops until logged in (needs a userId + city/age), so it's safe to fire on every mount.
  useEffect(() => {
    if (identity && identity.name && (identity.city || identity.age)) {
      enrichViaPersonSearch({ name: identity.name, city: identity.city, state: identity.state, age: identity.age });
    }
  }, [identity]);

  const goPay = useCallback((reason) => {
    navigate(`/payment?upgrade=1&reason=${reason || 'exposure'}`);
  }, [navigate]);

  const exp = computeExposure(identity, [], breach);

  // ── Unclaimed: capture the PII that unlocks the score (the free tier's value gate). ──
  if (!exp || !exp.count) {
    return <ConfirmIdentity onDone={(id) => setIdentity(id)} user={user} />;
  }

  const color = scoreColor(exp.score);
  const breachCount = (breach && breach.count) || 0;
  const breachClasses = (breach && (breach.topDataClasses || breach.topClasses)) || [];

  return (
    <div style={card}>
      <div>
        <div style={eyebrow}>Your identity exposure</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
          <span style={{ fontSize: 34, fontWeight: 900, color, lineHeight: 1 }}>{exp.score}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color }}>{exp.level} exposure</span>
        </div>
        <p style={{ margin: '6px 0 10px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
          <strong style={{ color: '#374151' }}>{exp.count} categor{exp.count === 1 ? 'y' : 'ies'}</strong> of your personal
          information {exp.count === 1 ? 'is' : 'are'} publicly exposed{breachCount > 0 ? `, and your email is in ${breachCount} known data breach${breachCount === 1 ? '' : 'es'}` : ''}.
        </p>
        <Bar score={exp.score} color={color} />
      </div>

      {/* Collapsed by default — fold the categories behind a toggle so the hero stays compact. */}
      <button type="button" style={toggleBtn} onClick={toggle} aria-expanded={expanded}>
        <span>{expanded ? 'Hide details' : `Show what's exposed (${exp.count})`}</span>
        <span aria-hidden="true" style={{ fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <>
          {/* Where you're exposed — REAL details in the clear (teaser, not a wall). */}
          <div>
            {exp.breakdown.slice(0, 6).map((r) => (
              <ExposureRow key={r.key} label={r.label} detail={r.detail} />
            ))}
          </div>

          {breachCount > 0 && breachClasses.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#7f1d1d' }}>
                Found in {breachCount} data breach{breachCount === 1 ? '' : 'es'}
              </div>
              <div style={{ fontSize: 12, color: '#9a3412', marginTop: 2 }}>
                Exposed: {breachClasses.slice(0, 4).join(' · ').toLowerCase()}
              </div>
            </div>
          )}

          <div>
            <button type="button" style={primaryCta} onClick={() => goPay('exposure')}>
              Hide what's exposed →
            </button>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9ca3af' }}>
              Subscribe to see every exposed detail — the exact addresses, relatives, and breaches — and remove them from public view. Cancel anytime.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Unclaimed state: the free tier can't score anything without PII, so this captures name + city + state.
 * City is important because the scary drivers (relatives, address history) need it to populate
 * (enrichViaPersonSearch refuses without city/age). Prefills from the account/mapped record when we have it.
 */
function ConfirmIdentity({ onDone, user }) {
  const seed = getMappedIdentity() || {};
  const [name, setName] = useState(seed.name || [user && user.firstName, user && user.lastName].filter(Boolean).join(' ') || '');
  const [city, setCity] = useState(seed.city || (user && (user.city || user.addressCity)) || '');
  const [state, setState] = useState(seed.state || (user && (user.state || user.addressState)) || '');
  const [busy, setBusy] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !state.trim()) return;
    setBusy(true);
    const selfPerson = { name: name.trim(), city: city.trim() || undefined, state: state.trim().toUpperCase() };
    // Local mirror first (unconditional) so the hero re-renders with a score immediately; server best-effort.
    updateMappedIdentity({ confirmed: true, name: selfPerson.name, city: selfPerson.city, state: selfPerson.state });
    saveMemberProfile({ selfPerson, city: selfPerson.city, state: selfPerson.state, source: 'exposure-claim' });
    // Populate relatives / address-history (the scary drivers) from PersonSearch — needs city, which we now have.
    enrichViaPersonSearch({ name: selfPerson.name, city: selfPerson.city, state: selfPerson.state });
    onDone(getMappedIdentity());
  };

  const field = { width: '100%', padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' };

  return (
    <form onSubmit={submit} style={card}>
      <div>
        <div style={eyebrow}>See what's public about you</div>
        <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800, color: '#111827' }}>How exposed is your identity?</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
          Confirm your info to see your free Exposure Score — what's publicly available about you online.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input style={field} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...field, flex: 2 }} placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
          <input style={{ ...field, flex: 1 }} placeholder="State" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} autoComplete="address-level1" />
        </div>
      </div>
      <button type="submit" disabled={busy || !name.trim() || !state.trim()} style={{ ...primaryCta, opacity: busy || !name.trim() || !state.trim() ? 0.6 : 1 }}>
        {busy ? 'Checking…' : 'Show my Exposure Score →'}
      </button>
    </form>
  );
}
