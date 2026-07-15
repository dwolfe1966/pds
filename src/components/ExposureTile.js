import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMappedIdentity, fetchMappedIdentity, computeExposure } from '../services/memberEnrichment';

/**
 * Dashboard Identity-exposure tile (Identity Management, slice 3). Shows the member's exposure score
 * from their mapped record + a CTA into the control surface. Renders nothing until they've mapped
 * their identity (the SelfIdentifyCard on the dashboard drives that first).
 */
const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 10px rgba(17,24,39,0.06)', marginBottom: '1rem' };
const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' };
const cta = { background: '#0d5d2f', color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' };

export default function ExposureTile() {
  const [identity, setIdentity] = useState(() => getMappedIdentity());
  useEffect(() => {
    let alive = true;
    fetchMappedIdentity().then((s) => { if (alive && s) setIdentity(s); });
    return () => { alive = false; };
  }, []);

  const exp = computeExposure(identity);
  if (!exp || !exp.count) return null;
  const c = exp.score >= 65 ? '#dc2626' : exp.score >= 35 ? '#f59e0b' : '#0d5d2f';

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ minWidth: 220 }}>
          <div style={eyebrow}>Identity exposure</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{exp.level}</div>
          <div style={{ fontSize: 13, color: '#6b7280' }}>{exp.count} data points public · {exp.items.slice(0, 3).join(' · ')}</div>
        </div>
        <Link to="/my-identity" style={cta}>Reduce my exposure →</Link>
      </div>
      <div style={{ height: 8, background: '#eef2f0', borderRadius: 999, overflow: 'hidden', marginTop: 12 }}>
        <div style={{ height: '100%', width: `${exp.score}%`, background: c }} />
      </div>
    </div>
  );
}
