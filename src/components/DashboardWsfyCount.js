import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWhoIsSearching } from '../services/wsfyClient';
import { getWsfyIdentity } from '../services/memberEnrichment';

/**
 * Compact "Who's Searching For You" count for the dashboard (owner 2026-07-16). Maximizes the pull:
 * shows the real searches count + profile-view count + the single strongest key signal, linking into
 * the full page. When we have no name to match on yet, it becomes the "add your name" on-ramp so a
 * new member can immediately see potential matches. Server resolves identity (mapped > card >
 * self-provided), so this just needs to hand it the member's selfUserId + any known name.
 */
// Long thin horizontal bar: text left, CTA right (owner 2026-07-16).
const bar = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.875rem',
  padding: '0.85rem 1.25rem', boxShadow: '0 4px 18px rgba(13,93,47,0.08)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
};
const cta = {
  display: 'inline-block', background: '#0d5d2f', color: '#fff', padding: '0.5rem 1rem',
  borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 14, whiteSpace: 'nowrap',
};

export default function DashboardWsfyCount() {
  const { user, isPaid } = useAuth();
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const identity = useMemo(() => getWsfyIdentity(user), [user]);

  useEffect(() => {
    let alive = true;
    if (!identity.selfUserId && !identity.name) { setLoaded(true); return undefined; }
    fetchWhoIsSearching({ ...identity, tier: isPaid ? 'paid' : 'free' })
      .then((r) => { if (alive) { setData(r); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [identity, isPaid]);

  if (!loaded) return null; // no flash — appears once resolved

  const searches = (data && data.count) || 0;
  const views = (data && data.profileViews && data.profileViews.count) || 0;
  const topSignal = data && Array.isArray(data.keySignals) && data.keySignals[0];

  // Nothing to match on yet → the on-ramp: add your name to see potential matches.
  const noIdentity = !data || (data.matchedVia === 'self_provided' && !identity.name && searches === 0 && views === 0);
  if (noIdentity) {
    return (
      <div style={bar}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>👀 See who’s searching for you</p>
          <p style={{ margin: '0.2rem 0 0', color: '#475569', fontSize: 13, lineHeight: 1.45 }}>Add your name to reveal who’s searched for and viewed you.</p>
        </div>
        <Link to="/my-identity" style={cta}>Add your name →</Link>
      </div>
    );
  }

  if (searches === 0 && views === 0) {
    return (
      <div style={bar}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>👀 Who’s searching for you</p>
          <p style={{ margin: '0.2rem 0 0', color: '#6b7280', fontSize: 13 }}>No searches yet — we’re watching.</p>
        </div>
        <Link to="/who-is-searching" style={{ ...cta, background: '#f1f5f9', color: '#0d5d2f' }}>View →</Link>
      </div>
    );
  }

  return (
    <div style={bar}>
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: '1.35rem', color: '#0d5d2f' }}>{searches}</span>
        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>searched for you</span>
        {views > 0 && (
          <span style={{ color: '#475569', fontSize: 13 }}>· <strong style={{ color: '#0f172a' }}>{views}</strong> viewed your profile</span>
        )}
        {topSignal && (
          <span style={{ color: '#334155', fontSize: 13, whiteSpace: 'nowrap' }}>· ⭐ {topSignal.reason}{isPaid && topSignal.name ? ` — ${topSignal.name}` : ''}</span>
        )}
      </div>
      <Link to="/who-is-searching" style={cta}>See who →</Link>
    </div>
  );
}
