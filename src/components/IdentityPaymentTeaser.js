import React, { useEffect, useState } from 'react';
import { getMappedIdentity, fetchMappedIdentity } from '../services/memberEnrichment';

/**
 * Identity-flow payment teaser (reason=identity). Shown when a member clicks "Control what's exposed"
 * from Account → My Identity. Anchors checkout on THEIR OWN mapped record (not a stale search vCard):
 * a vCard of what's public about them + the control/hide value prop.
 *
 * NOTE (owner 2026-07-14): later we'll combine the WSFY ("who's searching") and identity ("control
 * what's exposed") value props into one teaser. For now they're distinct (reason=wsfy vs reason=identity).
 */
const card = {
  background: '#fff', color: '#111827', border: '1px solid rgba(17,24,39,0.08)', borderRadius: '0.875rem',
  boxShadow: '0 4px 18px rgba(13,93,47,0.10)', maxWidth: 960, margin: '0 auto 1.25rem', overflow: 'hidden',
};

export default function IdentityPaymentTeaser() {
  const [identity, setIdentity] = useState(() => getMappedIdentity());
  useEffect(() => {
    let alive = true;
    fetchMappedIdentity().then((srv) => { if (alive && srv) setIdentity(srv); });
    return () => { alive = false; };
  }, []);

  const id = identity || {};
  const name = id.name || 'Your public record';
  const initial = (String(name).trim()[0] || '?').toUpperCase();
  const location = [id.city, id.state].filter(Boolean).join(', ');
  const chips = [
    (id.jobTitle || id.occupation) ? `💼 ${id.jobTitle || id.occupation}` : null,
    id.employer ? `🏢 ${id.employer}` : null,
    id.highSchool ? `🎓 ${id.highSchool}` : null,
    id.college ? `🎓 ${id.college}` : null,
    id.relativesCount != null ? `👥 ${id.relativesCount} relatives on record` : null,
    location ? `📍 ${location}` : null,
  ].filter(Boolean);

  return (
    <div style={card}>
      <div style={{ background: '#0d5d2f', color: '#fff', padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 }} aria-hidden="true">{initial}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#bbf7d0' }}>This is what's public about you</div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{name}{id.age ? `, ${id.age}` : ''}</div>
          {location && <div style={{ color: '#eafff0', fontSize: 14 }}>{location}</div>}
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {chips.map((chip) => (
              <span key={chip} style={{ fontSize: 13, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 999, padding: '5px 12px' }}>{chip}</span>
            ))}
          </div>
        )}
        <p style={{ margin: 0, color: '#0f172a', fontWeight: 700, fontSize: 15 }}>Take control of your identity.</p>
        <p style={{ margin: '4px 0 0', color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
          Hide your address and phone, remove yourself from data-broker sites, and see who's searching for you — all in one place.
        </p>
      </div>
    </div>
  );
}
