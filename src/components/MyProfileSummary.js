import React, { useState, useEffect } from 'react';
import { getMappedIdentity, fetchMappedIdentity, fetchSuppression, computeProtectionScore } from '../services/memberEnrichment';

/**
 * Compact "Your Profile" connector for the My Identity → Overview tab. Summarizes the modular profile
 * (protected / featured counts + protection score) and links into the full My Profile tab — the same
 * summary→workspace pattern as the Dashboard's compact cards. onManage switches to the modular tab.
 */

const MODULE_IDS = ['about', 'contact', 'locations', 'family', 'work', 'education', 'online', 'activity', 'court', 'property', 'financial'];
const chip = { fontSize: 12.5, fontWeight: 700, background: '#f8faf9', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 999, padding: '4px 11px' };

export default function MyProfileSummary({ onManage }) {
  const [identity, setIdentity] = useState(() => getMappedIdentity());
  const [dispositions, setDispositions] = useState({});
  const [suppressed, setSuppressed] = useState(false);
  const [hiddenFields, setHiddenFields] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchMappedIdentity().then((i) => { if (alive && i) setIdentity(i); });
    fetchSuppression().then((s) => { if (alive) { setDispositions(s.dispositions || {}); setSuppressed(!!s.activityHidden); setHiddenFields(s.hiddenFields || []); } });
    return () => { alive = false; };
  }, []);

  const protectedN = MODULE_IDS.filter((k) => dispositions[k] === 'protect').length;
  const promotedN = MODULE_IDS.filter((k) => dispositions[k] === 'promote').length;
  const ps = computeProtectionScore(identity, { suppressed, hiddenFields });

  return (
    <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, padding: '18px 20px', background: '#fff', boxShadow: '0 2px 10px rgba(13,93,47,0.06)' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Your Profile</div>
      <p style={{ margin: '6px 0 0', fontSize: 13.5, color: '#4b5563', lineHeight: 1.5, maxWidth: 560 }}>
        Curate what you show and hide what you don't — <strong>protect</strong> or <strong>promote</strong> each part of your profile,
        and preview exactly how others see you.
      </p>
      <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={chip}>🔒 {protectedN} protected</span>
        <span style={chip}>📣 {promotedN} featured</span>
        {ps && <span style={chip}>Protection {ps.score}/100</span>}
      </div>
      <button type="button" onClick={onManage}
        style={{ marginTop: 14, background: '#0d5d2f', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
        Manage your profile →
      </button>
    </div>
  );
}
