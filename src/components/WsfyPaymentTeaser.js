import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchWhoIsSearching } from '../services/wsfyClient';

/**
 * WSFY upsell hero for the payment page (reason=wsfy). A free member who tried to see who's
 * searching for them lands here — we reframe checkout around THAT value: the real "N people are
 * searching for you" count + the obfuscated tease, with blurred rows they'll unlock by subscribing.
 * The checkout form below does the conversion; this just makes the payoff concrete.
 */
// vCard style — white rectangle + shadow (owner). Matches the search vCard's footprint: constrained
// + centered to the 960px layout width, so on desktop it left-aligns with the form/secure-checkout
// and right-aligns with the $1-trial card. Mobile inherits full width (max-width caps out).
const hero = {
  background: '#fff', color: '#111827', border: '1px solid rgba(17,24,39,0.08)', borderRadius: '0.875rem',
  padding: '1.25rem 1.5rem', boxShadow: '0 4px 18px rgba(13,93,47,0.10)',
  maxWidth: 960, margin: '0 auto 1.25rem',
};
const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0d5d2f' };

export default function WsfyPaymentTeaser() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  const identity = useMemo(() => ({
    name: [user && user.firstName, user && user.lastName].filter(Boolean).join(' ') || (user && user.name) || '',
    city: (user && (user.city || user.addressCity)) || '',
    state: (user && (user.state || user.addressState)) || '',
    selfUserId: (user && (user.id || user._id || user.userId)) || undefined,
  }), [user]);

  useEffect(() => {
    let alive = true;
    if (!identity.name) return undefined;
    fetchWhoIsSearching({ ...identity, tier: 'free' })
      .then((r) => { if (alive) setData(r); })
      .catch(() => { /* best-effort — hero still renders a generic version */ });
    return () => { alive = false; };
  }, [identity]);

  const count = (data && data.count) || 0;
  const lines = (data && data.teaseSummary && data.teaseSummary.lines) || [];
  const rows = (data && data.events) ? data.events.slice(0, 4) : [];

  return (
    <div style={hero}>
      <div style={eyebrow}>👀 Who's searching for you</div>
      <h2 style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
        {count > 0
          ? `${count} ${count === 1 ? 'person is' : 'people are'} searching for you`
          : 'See who’s searching for you'}
      </h2>
      {lines.length > 0 && (
        <p style={{ margin: '6px 0 0', color: '#475569', fontSize: 14, lineHeight: 1.5 }}>{lines.join('  ·  ')}</p>
      )}

      {rows.length > 0 && (
        <div style={{ marginTop: 14, background: '#f8faf9', border: '1px solid #eef2f0', borderRadius: 10, padding: '10px 12px' }}>
          {rows.map((e, i) => (
            <div key={e.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < rows.length - 1 ? '1px solid #eef2f0' : 'none' }}>
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#e5e7eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, filter: 'blur(1px)' }} aria-hidden="true">?</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'inline-block', color: '#111827', fontWeight: 700, filter: 'blur(5px)', userSelect: 'none' }} aria-hidden="true">Full Name Hidden</span>
                <span style={{ display: 'block', color: '#6b7280', fontSize: 12 }}>Searched by {e.searchType || 'name'}{e.state ? ` · ${e.state}` : ''}</span>
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#0d5d2f', border: '1px solid #bbf7d0', borderRadius: 999, padding: '2px 8px' }}>🔒</span>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: '14px 0 0', color: '#0d5d2f', fontWeight: 700, fontSize: 15 }}>
        Subscribe to unlock exactly who’s searching for you {'—'} names, locations, and how they know you.
      </p>
    </div>
  );
}
