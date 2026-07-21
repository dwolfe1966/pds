import React, { useState, useEffect } from 'react';
import { fetchSocialPresence } from '../services/socialPresenceService';

/**
 * SocialPresenceTeaser — standalone social-presence tease for the HAS-RESULTS SERP (owner 2026-07-21:
 * social lives here, NOT competing inside the inmate/divorce/dating/SO flow teasers). Fetches the enriched
 * profiles for the searched person (name+state) and shows AS MUCH as we can — photo, name, every platform
 * with a masked handle — all gated behind 🔒/signup. Self-gating: renders nothing unless there's a match.
 * EXPERIMENTAL — behind REACT_APP_SIGNALS_SOCIAL. No faceprints (avatar passthrough only).
 */
const socialOn = () => process.env.REACT_APP_SIGNALS_SOCIAL === '1';

const NET = {
  linkedin: ['💼', 'LinkedIn'], facebook: ['📘', 'Facebook'], twitter: ['🐦', 'Twitter / X'], instagram: ['📸', 'Instagram'],
  youtube: ['▶️', 'YouTube'], tiktok: ['🎵', 'TikTok'], pinterest: ['📌', 'Pinterest'], reddit: ['👽', 'Reddit'],
  github: ['💻', 'GitHub'], gravatar: ['🖼️', 'Gravatar'], quora: ['❓', 'Quora'], crunchbase: ['📊', 'Crunchbase'],
  angellist: ['👼', 'AngelList'], vimeo: ['🎬', 'Vimeo'], 'about.me': ['🔗', 'about.me'], wordpress: ['📝', 'WordPress'],
};
const label = (n) => NET[n] || ['🌐', String(n || '').charAt(0).toUpperCase() + String(n || '').slice(1)];

export default function SocialPresenceTeaser({ firstName, lastName, state, theme = null }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!socialOn() || !lastName) return undefined;
    let alive = true;
    fetchSocialPresence({ firstName, lastName, state })
      .then((r) => { if (alive && r && r.matched && r.count) setData(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [firstName, lastName, state]);

  if (!data) return null;
  const name = [firstName, lastName].filter(Boolean).join(' ') || 'this person';
  const accent = theme ? theme.accentDark || theme.button : '#0d5d2f';
  const profiles = data.profiles || [];

  return (
    <div style={{ margin: '1.25rem 0', border: `1px solid ${accent}33`, borderRadius: 14, background: theme && theme.onDark ? 'rgba(255,255,255,0.04)' : '#f0f9ff', padding: '1.1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        {data.photoUrl ? (
          <img src={data.photoUrl} alt="" width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <span aria-hidden="true" style={{ fontSize: 26 }}>🌐</span>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: theme ? theme.ink : '#111827' }}>
            Found {name} on {profiles.length} social network{profiles.length === 1 ? '' : 's'}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
            {data.name && data.nameCorroborated ? <>Verified name match · </> : null}Sign up to view the profiles &amp; photos.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem 0.9rem' }}>
        {profiles.map((p, i) => {
          const [ic, lbl] = label(p.network);
          const handle = String(p.username || p.url || 'profile').replace(/^https?:\/\/(www\.)?/, '');
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: theme ? theme.ink : '#374151' }}>
              <span aria-hidden="true">{ic}</span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{lbl}</span>
              <span style={{ filter: 'blur(4px)', userSelect: 'none', color: accent, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{handle.slice(0, 20)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12 }}>🔒</span>
            </div>
          );
        })}
      </div>

      <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: accent, fontWeight: 600 }}>
        🔒 Unlock {name}'s social profiles, usernames &amp; photos in the full report.
      </p>
    </div>
  );
}
