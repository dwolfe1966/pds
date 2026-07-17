import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchWhoIsSearching } from '../services/wsfyClient';
import { getWsfyIdentity } from '../services/memberEnrichment';

/**
 * WSFY upsell hero for the payment page (reason=wsfy). A free member who tried to see who's searching
 * for them lands here — we reframe checkout around THAT value: the real count + profile views + the
 * specific mapping signals + a masked list of searchers (verified members show by name), with a link
 * through to their full Who's-Searching page. The checkout below unlocks the hidden names.
 */
const hero = {
  background: '#fff', color: '#111827', border: '1px solid rgba(17,24,39,0.08)', borderRadius: '0.875rem',
  padding: '1.25rem 1.5rem', boxShadow: '0 4px 18px rgba(13,93,47,0.10)',
  maxWidth: 960, margin: '0 auto 1.25rem',
};
const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#0d5d2f' };
const AFF = {
  relative: '👪 Family', verified_relative: '👪 Family', shared_relative: '👥 Shared relative',
  local: '🏠 In your area', past_local: '📍 Once near you', colleague: '💼 Colleague',
  high_school: '🎓 Your school', college: '🎓 Your college', frequent: '🔁 Repeat',
  has_phone: '📞 Has your number', has_email: '✉️ Has your email',
};

export default function WsfyPaymentTeaser() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  const identity = useMemo(() => getWsfyIdentity(user), [user]);

  useEffect(() => {
    let alive = true;
    if (!identity.name && !identity.selfUserId) return undefined;
    fetchWhoIsSearching({ ...identity, tier: 'free' })
      .then((r) => { if (alive) setData(r); })
      .catch(() => { /* best-effort — hero still renders a generic version */ });
    return () => { alive = false; };
  }, [identity]);

  const count = (data && data.count) || 0;
  const views = (data && data.profileViews && data.profileViews.count) || 0;
  const sameState = (data && data.sameStateCount) || 0;
  const highlights = (data && Array.isArray(data.highlights)) ? data.highlights : [];
  const rows = (data && Array.isArray(data.events)) ? data.events.slice(0, 4) : [];

  const stat = (n, l) => (
    <div style={{ flex: '1 1 auto', textAlign: 'center', padding: '0.5rem 0.4rem', background: '#f8faf9', border: '1px solid #eef2f0', borderRadius: 10, minWidth: 92 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0d5d2f', lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>{l}</div>
    </div>
  );

  return (
    <div style={hero}>
      <div style={eyebrow}>👀 Who's searching for you</div>
      <h2 style={{ margin: '6px 0 10px', fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
        {count > 0
          ? `${count} ${count === 1 ? 'person is' : 'people are'} searching for you`
          : 'See who’s searching for you'}
      </h2>

      {/* Stat strip — the concrete numbers. */}
      {(count > 0 || views > 0) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {stat(count, count === 1 ? 'searcher' : 'searchers')}
          {views > 0 && stat(views, views === 1 ? 'profile view' : 'profile views')}
          {sameState > 0 && stat(sameState, 'in your state')}
        </div>
      )}

      {/* Named mapping signals — real info, the payoff of confirming identity. */}
      {highlights.length > 0 && (
        <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
          {highlights.slice(0, 4).map((h) => {
            const sp = h.text.indexOf(' ');
            return (
              <div key={h.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#334155' }}>
                <span aria-hidden="true" style={{ fontSize: 15 }}>{h.icon}</span>
                <span><strong style={{ color: '#0f172a', fontWeight: 800 }}>{sp > 0 ? h.text.slice(0, sp) : h.text}</strong>{sp > 0 ? h.text.slice(sp) : ''}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Searcher list — verified members show by name; the rest are locked. */}
      {rows.length > 0 && (
        <div style={{ background: '#f8faf9', border: '1px solid #eef2f0', borderRadius: 10, padding: '4px 12px' }}>
          {rows.map((e, i) => {
            const chips = (e.affinities || []).map((a) => AFF[a]).filter(Boolean).slice(0, 2);
            const masked = !e.mapped;
            return (
              <div key={e.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: i < rows.length - 1 ? '1px solid #eef2f0' : 'none' }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: e.mapped ? '#dcfce7' : '#e5e7eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, filter: masked ? 'blur(1px)' : 'none', color: '#166534', fontWeight: 800 }} aria-hidden="true">
                  {e.mapped && e.name ? e.name[0] : '?'}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: '#111827', fontWeight: 700, filter: masked ? 'blur(5px)' : 'none', userSelect: masked ? 'none' : 'auto' }}>{e.name || 'Full name hidden'}</span>
                  {e.mapped && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '1px 6px' }}>🛡️ Verified</span>}
                  <span style={{ display: 'block', color: '#6b7280', fontSize: 12, marginTop: 1 }}>
                    Searched by {e.searchType || 'name'}{e.state ? ` · ${e.state}` : ''}{chips.length ? ` · ${chips.join(' · ')}` : ''}
                  </span>
                </span>
                {masked && <span style={{ fontSize: 11, fontWeight: 700, color: '#0d5d2f', border: '1px solid #bbf7d0', borderRadius: 999, padding: '2px 8px' }}>🔒</span>}
              </div>
            );
          })}
        </div>
      )}

      <p style={{ margin: '14px 0 0', color: '#0d5d2f', fontWeight: 700, fontSize: 15 }}>
        Subscribe to unlock exactly who’s searching for you — names, locations, and how they know you.
      </p>
      <Link to="/who-is-searching" style={{ display: 'inline-block', marginTop: 8, color: '#0d5d2f', fontSize: 13, fontWeight: 700, textDecoration: 'underline' }}>
        See your full Who’s-Searching page →
      </Link>
    </div>
  );
}
