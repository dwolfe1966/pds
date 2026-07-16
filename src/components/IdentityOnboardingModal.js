import React, { useEffect, useMemo, useState } from 'react';
import SelfIdentifyCard from './SelfIdentifyCard';
import { getMappedIdentity } from '../services/memberEnrichment';
import { useAuth } from '../context/AuthContext';
import { fetchWhoIsSearching } from '../services/wsfyClient';

/**
 * First-dashboard-visit modal that pushes the member into confirming their identity — the thing that
 * powers WSFY, the exposure score, and the whole Identity Management surface. Shows ONCE (localStorage
 * flag), and only if they haven't already mapped/identified. Embeds the self-identify flow so they can
 * do it right here; closes on complete or dismiss.
 */
const LS_SEEN = 'identityOnboardModalSeen';

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 1rem 2rem', overflowY: 'auto' };
const modal = { background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', position: 'relative' };
const closeBtn = { position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', fontSize: 26, lineHeight: 1, color: '#9ca3af', cursor: 'pointer' };

export default function IdentityOnboardingModal() {
  const { user, isPaid } = useAuth();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);

  const identity = useMemo(() => ({
    name: [user && user.firstName, user && user.lastName].filter(Boolean).join(' ') || (user && user.name) || '',
    city: (user && (user.city || user.addressCity)) || '',
    state: (user && (user.state || user.addressState)) || '',
    selfUserId: (user && (user.id || user._id || user.userId)) || undefined,
  }), [user]);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(LS_SEEN) === '1';
      const identified = localStorage.getItem('wsfySelfIdentified') === '1';
      const id = getMappedIdentity();
      const mapped = !!(id && (id.confirmed || id.name));
      if (!seen && !identified && !mapped) {
        setOpen(true);
        localStorage.setItem(LS_SEEN, '1'); // first time only
      }
    } catch { /* storage unavailable */ }
  }, []);

  // Personalize with the REAL count when we have a name to match on — turns the generic pitch into
  // "N people are already searching for you". Best-effort; falls back to the generic headline.
  useEffect(() => {
    let alive = true;
    if (!open || (!identity.selfUserId && !identity.name)) return undefined;
    fetchWhoIsSearching({ ...identity, tier: isPaid ? 'paid' : 'free' })
      .then((r) => { if (alive && r && typeof r.count === 'number') setCount(r.count); })
      .catch(() => { /* generic headline */ });
    return () => { alive = false; };
  }, [open, identity, isPaid]);

  if (!open) return null;
  const close = () => setOpen(false);
  const hasCount = count > 0;

  return (
    <div style={overlay} onClick={close}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" style={closeBtn} onClick={close} aria-label="Close">×</button>
        <div style={{ padding: '26px 26px 4px' }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0d5d2f' }}>
            {hasCount
              ? `${count} ${count === 1 ? 'person is' : 'people are'} already searching for you`
              : 'Take control of your identity'}
          </h2>
          <p style={{ margin: '8px 0 14px', color: '#4b5563', fontSize: 14, lineHeight: 1.5 }}>
            {hasCount
              ? 'Claim your record to see who’s searching — and control what’s public about you:'
              : 'Confirm your public record so you can:'}
          </p>
          <ul style={{ margin: '0 0 8px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['👀', 'See who’s searching for you'],
              ['🔎', 'See exactly what’s public about you'],
              ['🔒', 'Hide what you don’t want exposed'],
            ].map(([icon, text]) => (
              <li key={text} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14, color: '#111827' }}>
                <span aria-hidden="true" style={{ fontSize: 18 }}>{icon}</span>{text}
              </li>
            ))}
          </ul>
        </div>
        <div style={{ padding: '4px 26px 26px' }}>
          <SelfIdentifyCard forceShow onComplete={close} />
        </div>
      </div>
    </div>
  );
}
