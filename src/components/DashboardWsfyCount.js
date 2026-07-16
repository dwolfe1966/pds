import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWhoIsSearching } from '../services/wsfyClient';

/**
 * Compact "Who's Searching For You" count for the dashboard (owner 2026-07-16). Maximizes the pull:
 * shows the real searches count + profile-view count + the single strongest key signal, linking into
 * the full page. When we have no name to match on yet, it becomes the "add your name" on-ramp so a
 * new member can immediately see potential matches. Server resolves identity (mapped > card >
 * self-provided), so this just needs to hand it the member's selfUserId + any known name.
 */
const card = {
  background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.875rem',
  padding: '1.1rem 1.25rem', boxShadow: '0 4px 18px rgba(13,93,47,0.08)',
};
const cta = {
  display: 'inline-block', background: '#0d5d2f', color: '#fff', padding: '0.5rem 1rem',
  borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 14,
};

export default function DashboardWsfyCount() {
  const { user, isPaid } = useAuth();
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const identity = useMemo(() => ({
    name: [user && user.firstName, user && user.lastName].filter(Boolean).join(' ') || (user && user.name) || '',
    city: (user && (user.city || user.addressCity)) || '',
    state: (user && (user.state || user.addressState)) || '',
    selfUserId: (user && (user.id || user._id || user.userId)) || undefined,
  }), [user]);

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
      <div style={card}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>👀 See who’s searching for you</p>
        <p style={{ margin: '0.35rem 0 0.9rem', color: '#475569', fontSize: 14, lineHeight: 1.5 }}>
          Add your name and we’ll show you who’s already searched for and viewed your profile.
        </p>
        <Link to="/my-identity" style={cta}>Add your name →</Link>
      </div>
    );
  }

  if (searches === 0 && views === 0) {
    return (
      <div style={card}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>👀 Who’s searching for you</p>
        <p style={{ margin: '0.35rem 0 0', color: '#6b7280', fontSize: 14 }}>
          No searches yet — we’re watching. You’ll see them here the moment someone looks you up.
        </p>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: '1.5rem', color: '#0d5d2f' }}>{searches}</span>
        <span style={{ fontWeight: 700, color: '#0f172a' }}>{searches === 1 ? 'person searched' : 'people searched'} for you</span>
        {views > 0 && (
          <span style={{ color: '#475569', fontSize: 14 }}>· <strong style={{ color: '#0f172a' }}>{views}</strong> viewed your profile</span>
        )}
      </div>
      {topSignal && (
        <p style={{ margin: '0.5rem 0 0', color: '#334155', fontSize: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 999, background: '#dcfce7', color: '#166534', marginRight: 8 }}>⭐ key</span>
          {topSignal.reason}{isPaid && topSignal.name ? ` — ${topSignal.name}` : ''}
        </p>
      )}
      <div style={{ marginTop: '0.9rem' }}>
        <Link to="/who-is-searching" style={cta}>See who →</Link>
      </div>
    </div>
  );
}
