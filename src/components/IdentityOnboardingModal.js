import React, { useEffect, useState } from 'react';
import SelfIdentifyCard from './SelfIdentifyCard';
import { getMappedIdentity } from '../services/memberEnrichment';

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
  const [open, setOpen] = useState(false);

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

  if (!open) return null;
  const close = () => setOpen(false);

  return (
    <div style={overlay} onClick={close}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <button type="button" style={closeBtn} onClick={close} aria-label="Close">×</button>
        <div style={{ padding: '26px 26px 4px' }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0d5d2f' }}>Take control of your identity</h2>
          <p style={{ margin: '8px 0 14px', color: '#4b5563', fontSize: 14, lineHeight: 1.5 }}>
            Confirm your public record so you can:
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
