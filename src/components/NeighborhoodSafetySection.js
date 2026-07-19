import React, { useEffect, useState } from 'react';
import { fetchOffendersNearby } from '../services/lifeEventsService';

/**
 * Neighborhood safety — registered sex offenders NEAR a location (owner 2026-07-19). This is the RIGHT use of
 * NSOPW data: geographic ("who lives near this address"), NOT name-attribution ("is this person an offender").
 * No attribution problem, real protect-your-family value. Keyed on the profile's current-location ZIP.
 *
 * @param {{ zip?:string, zips?:string[], name?:string, location?:string, context?:'identity'|'search' }} props
 */
export default function NeighborhoodSafetySection({ zip, zips, name, location, context = 'identity' }) {
  const [data, setData] = useState(null);
  const list = (zips && zips.length ? zips : (zip ? [zip] : [])).filter(Boolean);
  const isSelf = context === 'identity';

  useEffect(() => {
    let alive = true;
    if (!list.length) return undefined;
    fetchOffendersNearby({ zips: list }).then((r) => { if (alive) setData(r); }).catch(() => {});
    return () => { alive = false; };
  }, [list.join(',')]);

  const records = (data && data.records) || [];
  if (!list.length || !records.length) return null;

  const whose = isSelf ? 'your current location' : `${name ? `${name}'s ` : 'this '}current location`;
  const preview = records.slice(0, 6);

  return (
    <section style={{ margin: '20px 0', border: '1px solid #fed7aa', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #ffedd5', background: '#fff7ed' }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#9a3412' }}>🚸 Registered Offenders Near {isSelf ? 'You' : (name || 'This Location')} <span>({data.count}{data.count >= records.length && records.length >= 25 ? '+' : ''})</span></h2>
        <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#7c2d12' }}>
          {data.count} registered sex offender{data.count === 1 ? '' : 's'} in the registry near {whose}{location ? ` (${location})` : ''}. Location-based — not linked to any specific person.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '14px 18px' }}>
        {preview.map((r, i) => (
          <a key={i} href={r.registryUrl || undefined} target="_blank" rel="noopener noreferrer" style={{ flex: '0 0 auto', width: 78, textAlign: 'center', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ width: 78, height: 94, borderRadius: 8, background: '#f1f5f9', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#94a3b8' }}>
              👤
              {r.photoUrl && <img src={r.photoUrl} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[r.city, r.state].filter(Boolean).join(', ')}</div>
          </a>
        ))}
      </div>
      <div style={{ padding: '10px 18px', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #ffedd5' }}>
        Source: NSOPW (national registry). Tap a photo to view the official registry entry. Public data, not a consumer report.
      </div>
    </section>
  );
}
